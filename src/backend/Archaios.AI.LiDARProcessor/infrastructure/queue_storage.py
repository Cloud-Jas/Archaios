from azure.storage.queue import QueueClient
from core.interfaces import IQueueStorage

class AzureQueueStorage(IQueueStorage):
    def __init__(self, connection_string: str, queue_name: str):
        self.queue_client = QueueClient.from_connection_string(
            connection_string, 
            queue_name
        )

    async def receive_messages(self) -> list:
        return self.queue_client.receive_messages()

    async def delete_message(self, message) -> None:
        self.queue_client.delete_message(message)
