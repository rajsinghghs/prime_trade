from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.schemas import UserResponse, AdminUserUpdate, MessageResponse
from app.core.dependencies import require_admin
from app.models.models import User
from app.core.security import get_password_hash

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get(
    "/users",
    response_model=list[UserResponse],
    summary="[Admin] List all users",
)
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return db.query(User).all()


@router.get(
    "/users/{user_id}",
    response_model=UserResponse,
    summary="[Admin] Get user by ID",
)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.patch(
    "/users/{user_id}",
    response_model=UserResponse,
    summary="[Admin] Update user role or status",
)
def update_user(
    user_id: str,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    else:
        update_data.pop("password", None)

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete(
    "/users/{user_id}",
    response_model=MessageResponse,
    summary="[Admin] Deactivate a user account",
)
def deactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = False
    db.commit()
    return MessageResponse(message=f"User {user.username} deactivated successfully")
