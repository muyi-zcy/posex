import datetime
import enum
from typing import Generic, TypeVar, Optional, Union

import pytz
from fastapi import status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic.generics import GenericModel
from exception.myException import MyException

DataT = TypeVar("DataT")



def encoder_datetime(dt: datetime.datetime):
    china_tz = pytz.timezone('Asia/Shanghai')
    return dt.astimezone(china_tz).strftime("%Y-%m-%d %H:%M:%S")


dto_custom_encoder = {
    datetime.datetime: lambda dt: encoder_datetime(dt)
}


def custom_encoder(data):
    if isinstance(data, enum.Enum):
        return jsonable_encoder(data, custom_encoder=dto_custom_encoder)
    elif hasattr(data, '__dict__'):
        return custom_encoder(vars(data))
    elif isinstance(data, dict):
        new_data = {}
        for key, value in data.items():
            new_data[key] = custom_encoder(value)
        return new_data
    elif isinstance(data, list):
        return [custom_encoder(item) for item in data]
    return jsonable_encoder(data, custom_encoder=dto_custom_encoder)


class MyResult(GenericModel, Generic[DataT]):
    code: Union[str, None]
    message: Union[str, None]
    success: Union[bool, None]
    data: Optional[DataT] = None

    @classmethod
    def ok(cls, data=None):
        if data is not None:
            data = custom_encoder(data)

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                'code': '200',
                'message': "OK",
                'success': True,
                'data': data
            },
        )

    @classmethod
    def fail(cls, code=None, message=None, data=None, myException: MyException = None):
        if myException is not None:
            code = myException.status_code

        if message is None and myException is not None and myException.message:
            message = myException.message

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                'code': code,
                'message': message,
                'success': False,
                'data': data
            }
        )
