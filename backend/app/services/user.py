"""
用户服务
"""
from typing import Optional
from sqlalchemy.orm import Session

from app.models import User
from app.schemas.user import UserCreate


class UserService:
    """用户相关业务逻辑"""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: str) -> Optional[User]:
        """根据 ID 获取用户"""
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_email(self, email: str) -> Optional[User]:
        """根据邮箱获取用户"""
        return self.db.query(User).filter(User.email == email).first()

    def create(self, data: UserCreate) -> User:
        """创建用户"""
        user = User(
            id=data.id,
            name=data.name,
            email=data.email,
            avatar=data.avatar,
            auth_provider=data.provider,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update(self, user: User, data: UserCreate) -> User:
        """更新用户信息"""
        user.name = data.name
        user.email = data.email
        user.avatar = data.avatar
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_or_create(self, data: UserCreate) -> User:
        """获取或创建用户"""
        user = self.get_by_id(data.id)
        if user:
            return self.update(user, data)
        return self.create(data)
