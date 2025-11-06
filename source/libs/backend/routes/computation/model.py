from pydantic import BaseModel


class UserInput(BaseModel):
    prompt: str
    model: str
    device_type: str
    location: str
    has_gpu: bool


class EnterpriseInput(BaseModel):
    prompt: str
    model: str
    device_type: str
    location: str
    has_gpu: bool
    queries_per_user_per_day: int
    number_of_employees: int