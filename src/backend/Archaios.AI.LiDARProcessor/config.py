from dataclasses import dataclass
from dotenv import load_dotenv
import os

@dataclass
class AppConfig:
    storage_connection: str
    queue_name: str
    function_base_url: str
    task_hub: str
    connection_name: str
    system_key: str
    local_mode: bool = False

    @classmethod
    def from_env(cls):
        load_dotenv()
        return cls(
            storage_connection=os.getenv('AZURE_STORAGE_CONNECTION_STRING'),
            queue_name=os.getenv('QUEUE_NAME', 'lidar-processing'),
            function_base_url=os.getenv('FUNCTION_BASE_URL'),
            task_hub=os.getenv('TASK_HUB', 'LiDARHub'),
            connection_name=os.getenv('CONNECTION_NAME', 'Storage'),
            system_key=os.getenv('SYSTEM_KEY'),
            local_mode =os.getenv('LOCAL_MODE', 'false').lower() in ('true', 'yes', '1')
        )
