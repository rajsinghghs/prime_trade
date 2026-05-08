from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from datetime import datetime, timezone

from app.models.models import User, UserRole
from app.schemas.schemas import UserRegister, UserLogin, TokenResponse
from app.core.security import (
    get_password_hash, verify_password,
    create_access_token, create_refresh_token, decode_token
)
from app.core.config import settings


class AuthService:

    @staticmethod
    def register_user(db: Session, payload: UserRegister) -> User:
        # Check duplicates
        if db.query(User).filter(User.email == payload.email).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
                headers={"X-Error-Code": "EMAIL_TAKEN"},
            )
        if db.query(User).filter(User.username == payload.username).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already taken",
                headers={"X-Error-Code": "USERNAME_TAKEN"},
            )

        # First user gets admin role (bootstrap)
        is_first_user = db.query(User).count() == 0
        role = UserRole.ADMIN if is_first_user else UserRole.USER

        user = User(
            email=payload.email.lower(),
            username=payload.username.lower(),
            hashed_password=get_password_hash(payload.password),
            full_name=payload.full_name,
            role=role,
            is_verified=is_first_user,
        )

        try:
            db.add(user)
            db.commit()
            db.refresh(user)
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Registration conflict, please try again",
            )
        return user

    @staticmethod
    def login_user(db: Session, payload: UserLogin) -> TokenResponse:
        user = db.query(User).filter(User.email == payload.email.lower()).first()

        # Constant-time comparison to prevent timing attacks
        if not user or not verify_password(payload.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated. Contact support.",
            )

        # Update last login
        user.last_login = datetime.now(timezone.utc)
        db.commit()

        token_data = {"sub": user.id, "role": user.role.value, "email": user.email}
        return TokenResponse(
            access_token=create_access_token(token_data),
            refresh_token=create_refresh_token(token_data),
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    @staticmethod
    def refresh_tokens(db: Session, refresh_token: str) -> TokenResponse:
        payload = decode_token(refresh_token)

        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        user = db.query(User).filter(
            User.id == payload.get("sub"),
            User.is_active == True
        ).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )

        token_data = {"sub": user.id, "role": user.role.value, "email": user.email}
        return TokenResponse(
            access_token=create_access_token(token_data),
            refresh_token=create_refresh_token(token_data),
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
