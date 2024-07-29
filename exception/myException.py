from .commonErrorCode import CommonErrorCode

class MyException(Exception):
    def __init__(self, status_code=None, message=None, commonError: CommonErrorCode = None):

        if commonError is not None and message is None:
            message = commonError.message

        if commonError is not None:
            status_code = commonError.result_code

        if status_code is None:
            status_code = "500"

        super().__init__(message)
        self.message = message
        self.status_code = status_code
