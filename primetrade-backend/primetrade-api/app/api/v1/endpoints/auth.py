from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.schemas import (
    UserRegister, UserLogin, TokenResponse,
    UserResponse, RefreshTokenRequest, MessageResponse
)
from app.services.auth_service import AuthService
from app.core.dependencies import get_current_active_user
from app.models.models import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Creates a new user account. First registered user is automatically admin.",
)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    user = AuthService.register_user(db, payload)
    return user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate user and get JWT tokens",
)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    return AuthService.login_user(db, payload)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token using refresh token",
)
def refresh_token(payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    return AuthService.refresh_tokens(db, payload.refresh_token)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user profile",
)
def get_me(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Logout (client should discard tokens)",
)
def logout(current_user: User = Depends(get_current_active_user)):
    # Stateless JWT: advise client to discard token.
    # For production, maintain a token blacklist in Redis.
    return MessageResponse(message="Successfully logged out. Please discard your tokens.")
