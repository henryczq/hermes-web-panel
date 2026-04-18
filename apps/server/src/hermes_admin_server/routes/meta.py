from fastapi import APIRouter

from admin_contract.models import ApiEnvelope


router = APIRouter()


@router.get("/meta", response_model=ApiEnvelope[dict[str, str]])
def meta() -> ApiEnvelope[dict[str, str]]:
    return ApiEnvelope(
        success=True,
        data={
            "name": "hermes-web-panel",
            "runtime": "python",
            "scope": "Hermes Agent management",
        },
    )
