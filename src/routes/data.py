from fastapi import FastAPI, APIRouter, Depends, UploadFile, status, Request
from fastapi.responses import JSONResponse
import os
from helpers.config import get_settings, Settings
from controllers import DataController, ProjectController, ProcessController, NLPController
import aiofiles
from models import ResponseSignal
import logging
from .schemes.data import ProcessRequest, CreateProjectRequest
import re
from models.ProjectModel import ProjectModel
from models.ChunkModel import ChunkModel
from models.AssetModel import AssetModel
from models.db_schemes import DataChunk, Asset, Project
from models.enums.AssetTypeEnum import AssetTypeEnum

logger = logging.getLogger('uvicorn.error')

data_router = APIRouter(
    prefix="/api/v1/data",
    tags=["api_v1", "data"],
)

@data_router.post("/upload/{project_id}")
async def upload_data(request: Request, project_id: str, file: UploadFile,
                      app_settings: Settings = Depends(get_settings)):
        
    
    project_model = await ProjectModel.create_instance(
        db_client=request.app.db_client
    )

    project = await project_model.get_project_or_create_one(
        project_id=project_id
    )

    # validate the file properties
    data_controller = DataController()

    is_valid, result_signal = data_controller.validate_uploaded_file(file=file)

    if not is_valid:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "signal": result_signal
            }
        )

    project_dir_path = ProjectController().get_project_path(project_id=project_id)
    file_path, file_id = data_controller.generate_unique_filepath(
        orig_file_name=file.filename,
        project_id=project_id
    )

    try:
        async with aiofiles.open(file_path, "wb") as f:
            while chunk := await file.read(app_settings.FILE_DEFAULT_CHUNK_SIZE):
                await f.write(chunk)
    except Exception as e:

        logger.error(f"Error while uploading file: {e}")

        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "signal": ResponseSignal.FILE_UPLOAD_FAILED.value
            }
        )

    # store the assets into the database
    asset_model = await AssetModel.create_instance(
        db_client=request.app.db_client
    )

    asset_resource = Asset(
        asset_project_id=project.id,
        asset_type=AssetTypeEnum.FILE.value,
        asset_name=file_id,
        asset_size=os.path.getsize(file_path)
    )

    asset_record = await asset_model.create_asset(asset=asset_resource)

    return JSONResponse(
            content={
                "signal": ResponseSignal.FILE_UPLOAD_SUCCESS.value,
                "file_id": str(asset_record.id),
            }
        )

@data_router.post("/process/{project_id}")
async def process_endpoint(request: Request, project_id: str, process_request: ProcessRequest):

    chunk_size = process_request.chunk_size
    overlap_size = process_request.overlap_size
    do_reset = process_request.do_reset

    project_model = await ProjectModel.create_instance(
        db_client=request.app.db_client
    )

    project = await project_model.get_project_or_create_one(
        project_id=project_id
    )

    asset_model = await AssetModel.create_instance(
            db_client=request.app.db_client
        )

    project_files_ids = {}
    if process_request.file_id:
        asset_record = await asset_model.get_asset_record(
            asset_project_id=project.id,
            asset_name=process_request.file_id
        )

        if asset_record is None:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "signal": ResponseSignal.FILE_ID_ERROR.value,
                }
            )

        project_files_ids = {
            asset_record.id: asset_record.asset_name
        }
    
    else:
        

        project_files = await asset_model.get_all_project_assets(
            asset_project_id=project.id,
            asset_type=AssetTypeEnum.FILE.value,
        )

        project_files_ids = {
            record.id: record.asset_name
            for record in project_files
        }

    if len(project_files_ids) == 0:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "signal": ResponseSignal.NO_FILES_ERROR.value,
            }
        )
    
    process_controller = ProcessController(project_id=project_id)

    no_records = 0
    no_files = 0

    chunk_model = await ChunkModel.create_instance(
                        db_client=request.app.db_client
                    )

    if do_reset == 1:
        _ = await chunk_model.delete_chunks_by_project_id(
            project_id=project.id
        )

    for asset_id, file_id in project_files_ids.items():

        file_content = process_controller.get_file_content(file_id=file_id)

        if file_content is None:
            logger.error(f"Error while processing file: {file_id}")
            continue

        file_chunks = process_controller.process_file_content(
            file_content=file_content,
            file_id=file_id,
            chunk_size=chunk_size,
            overlap_size=overlap_size
        )

        if file_chunks is None or len(file_chunks) == 0:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "signal": ResponseSignal.PROCESSING_FAILED.value
                }
            )

        file_chunks_records = [
            DataChunk(
                chunk_text=chunk.page_content,
                chunk_metadata=chunk.metadata,
                chunk_order=i+1,
                chunk_project_id=project.id,
                chunk_asset_id=asset_id
            )
            for i, chunk in enumerate(file_chunks)
        ]

        no_records += await chunk_model.insert_many_chunks(chunks=file_chunks_records)
        no_files += 1

    return JSONResponse(
        content={
            "signal": ResponseSignal.PROCESSING_SUCCESS.value,
            "inserted_chunks": no_records,
            "processed_files": no_files
        }
    )


@data_router.post("/ingest/{project_id}")
async def ingest_data(request: Request, project_id: str, file: UploadFile,
                      chunk_size: int = 512, overlap_size: int = 50,
                      app_settings: Settings = Depends(get_settings)):
    """
    Takes a document from upload to answerable in one call: store it, split it
    into chunks, embed those chunks and add them to the project's collection.

    The three existing endpoints still do these steps individually. This one
    exists so a client cannot strand a file half-way through the pipeline —
    uploaded but never chunked, or chunked but never embedded.
    """
    project_model = await ProjectModel.create_instance(
        db_client=request.app.db_client
    )

    project = await project_model.get_project_or_create_one(project_id=project_id)

    data_controller = DataController()

    is_valid, result_signal = data_controller.validate_uploaded_file(file=file)
    if not is_valid:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"signal": result_signal}
        )

    file_path, file_id = data_controller.generate_unique_filepath(
        orig_file_name=file.filename,
        project_id=project_id
    )

    try:
        async with aiofiles.open(file_path, "wb") as f:
            while chunk := await file.read(app_settings.FILE_DEFAULT_CHUNK_SIZE):
                await f.write(chunk)
    except Exception as e:
        logger.error(f"Error while uploading file: {e}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"signal": ResponseSignal.FILE_UPLOAD_FAILED.value}
        )

    asset_model = await AssetModel.create_instance(db_client=request.app.db_client)

    asset_record = await asset_model.create_asset(asset=Asset(
        asset_project_id=project.id,
        asset_type=AssetTypeEnum.FILE.value,
        asset_name=file_id,
        asset_size=os.path.getsize(file_path)
    ))

    process_controller = ProcessController(project_id=project_id)

    file_content = process_controller.get_file_content(file_id=file_id)
    if file_content is None:
        logger.error(f"Error while reading file: {file_id}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"signal": ResponseSignal.PROCESSING_FAILED.value}
        )

    file_chunks = process_controller.process_file_content(
        file_content=file_content,
        file_id=file_id,
        chunk_size=chunk_size,
        overlap_size=overlap_size
    )

    if not file_chunks:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"signal": ResponseSignal.PROCESSING_FAILED.value}
        )

    chunk_records = [
        DataChunk(
            chunk_text=chunk.page_content,
            chunk_metadata=chunk.metadata,
            chunk_order=i + 1,
            chunk_project_id=project.id,
            chunk_asset_id=asset_record.id
        )
        for i, chunk in enumerate(file_chunks)
    ]

    chunk_model = await ChunkModel.create_instance(db_client=request.app.db_client)
    await chunk_model.insert_many_chunks(chunks=chunk_records)

    nlp_controller = NLPController(
        vectordb_client=request.app.vectordb_client,
        generation_client=request.app.generation_client,
        embedding_client=request.app.embedding_client,
        template_parser=request.app.template_parser
    )

    collection_name = nlp_controller.create_collection_name(project_id=project.project_id)

    # Created before the count is read, both because the collection may not
    # exist yet and because the count is what keeps this file's vector ids from
    # colliding with those of files already indexed.
    request.app.vectordb_client.create_collection(
        collection_name=collection_name,
        embedding_size=request.app.embedding_client.embedding_size,
        do_reset=False
    )

    collection_info = nlp_controller.get_vector_db_collection_info(project=project)
    offset = (collection_info or {}).get("points_count") or 0

    is_inserted = nlp_controller.index_into_vector_db(
        project=project,
        chunks=chunk_records,
        chunks_ids=list(range(offset, offset + len(chunk_records))),
        do_reset=False
    )

    if not is_inserted:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"signal": ResponseSignal.INSERT_INTO_VECTORDB_ERROR.value}
        )

    return JSONResponse(content={
        "signal": ResponseSignal.PROCESSING_SUCCESS.value,
        "file_id": str(asset_record.id),
        "file_name": file.filename,
        "chunks": len(chunk_records),
    })


# Stored file names carry a random uniqueness prefix (see
# DataController.generate_unique_filepath); users should see the name they gave.
STORED_NAME_PREFIX = re.compile(r"^[a-z0-9]{12}_")


def display_file_name(asset_name: str) -> str:
    return STORED_NAME_PREFIX.sub("", asset_name)


@data_router.get("/projects")
async def list_projects(request: Request, page: int = 1, page_size: int = 50):
    """Backs the workspace rail in the UI."""
    project_model = await ProjectModel.create_instance(db_client=request.app.db_client)

    projects, total_pages = await project_model.get_all_projects(page=page, page_size=page_size)

    return JSONResponse(content={
        "signal": ResponseSignal.PROJECT_LIST_RETRIEVED.value,
        "projects": [
            {
                "project_id": project.project_id,
                "project_name": project.project_name or project.project_id,
            }
            for project in projects
        ],
        "total_pages": total_pages,
    })


@data_router.post("/projects")
async def create_project(request: Request, create_request: CreateProjectRequest):
    """
    Creates a workspace from a display name. The id is generated rather than
    derived from the name because project_id is validated as alphanumeric and
    doubles as the Qdrant collection name.
    """
    project_model = await ProjectModel.create_instance(db_client=request.app.db_client)

    project_id = DataController().generate_random_string()

    project = await project_model.create_project(project=Project(
        project_id=project_id,
        project_name=create_request.name,
    ))

    return JSONResponse(content={
        "signal": ResponseSignal.PROJECT_CREATED.value,
        "project": {
            "project_id": project.project_id,
            "project_name": project.project_name,
        },
    })


@data_router.get("/files/{project_id}")
async def list_project_files(request: Request, project_id: str):
    """Backs the file tray in the UI."""
    project_model = await ProjectModel.create_instance(db_client=request.app.db_client)
    project = await project_model.get_project_or_create_one(project_id=project_id)

    asset_model = await AssetModel.create_instance(db_client=request.app.db_client)

    assets = await asset_model.get_all_project_assets(
        asset_project_id=project.id,
        asset_type=AssetTypeEnum.FILE.value,
    )

    return JSONResponse(content={
        "signal": ResponseSignal.FILE_LIST_RETRIEVED.value,
        "files": [
            {
                "file_id": str(asset.id),
                "file_name": display_file_name(asset.asset_name),
                "size": asset.asset_size,
            }
            for asset in assets
        ],
    })
