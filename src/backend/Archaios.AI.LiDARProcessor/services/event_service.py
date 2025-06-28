import aiohttp
from core.interfaces import IEventService
from config import AppConfig

class DurableEventService(IEventService):
    def __init__(self, config: AppConfig):
        self.config = config

    async def raise_completion_event(self, instance_id: str, event_name: str, result: dict) -> None:
        url = (f"{self.config.function_base_url}/runtime/webhooks/durabletask/instances/{instance_id}/"
               f"raiseEvent/{event_name}?"
               f"connection={self.config.connection_name}&"
               f"code={self.config.system_key}")
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=result) as response:
                if response.status != 202:
                    print(f"Failed to raise event: {response.status}, {await response.text()}")
