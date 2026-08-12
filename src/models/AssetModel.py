from models.db_schemas.asset import Asset

from .BaseDataModel import BaseDataModel
from .db_schemas import Project
from .enums.DatabaseEnums import DatabaseEnum
from bson.objectid import ObjectId

class AssetModel(BaseDataModel):

    def __init__(self, db_client: object):
        super().__init__(db_client=db_client)
        self.collection = self.db_client[self.settings.MONGODB_DATABASE][DatabaseEnum.COLLECTION_ASSET_NAME.value]

    @classmethod
    async def create_instance(cls, db_client: object):
        instance = cls(db_client=db_client)
        await instance.init_collection()
        return instance

    async def init_collection(self):
        all_collections = await self.db_client[self.settings.MONGODB_DATABASE].list_collection_names()
        if DatabaseEnum.COLLECTION_ASSET_NAME.value not in all_collections:
            self.collection = self.db_client[self.settings.MONGODB_DATABASE][DatabaseEnum.COLLECTION_ASSET_NAME.value]
            indices = Asset.get_indices()
            for index in indices:
                await self.collection.create_index(
                    index["key"], 
                    name=index["name"], 
                    unique=index["unique"]
                    )
                


    async def create_asset(self, asset: Asset):

        result = await self.collection.insert_one(asset.dict(by_alias=True, exclude_unset=True))
        asset.id = result.inserted_id

        return asset

    async def get_all_assets(self, asset_project_id: str, asset_type: str = "file"):

        return await self.collection.find({
            "asset_project_id": ObjectId(asset_project_id) if isinstance(asset_project_id, str) else asset_project_id,
            "asset_type": asset_type
        }).to_list(length=None)