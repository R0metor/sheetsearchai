from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GOOGLE_SERVICE_ACCOUNT_FILE: str
    SHEET_ID: str   
    OPENAI_API_KEY: str

    class Config:
        env_file = ".env"

settings = Settings()
