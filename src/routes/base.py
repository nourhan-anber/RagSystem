from fastapi import FastAPI, APIRouter, Depends
import os
from helpers.config import get_settings, Settings

base_Router = APIRouter()

@base_Router.get("/")
async def welcome(app_settings : Settings =Depends(get_settings)):
    app_name = app_settings.APP_NAME
    app_version = app_settings.APP_VERSION
    return {
        "App Name": app_name,
        "App Version": app_version
    }
