"""
用户服务
"""
import uuid
from typing import Optional

from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.models import User
from app.schemas.user import UserCreate

# 密码哈希上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserService:
    """用户相关业务逻辑"""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: str) -> Optional[User]:
        """根据 ID 获取用户"""
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_username(self, username: str) -> Optional[User]:
        """根据用户名获取用户"""
        return self.db.query(User).filter(User.username == username).first()

    def get_by_email(self, email: str) -> Optional[User]:
        """根据邮箱获取用户"""
        return self.db.query(User).filter(User.email == email).first()

    def get_by_github_id(self, github_id: str) -> Optional[User]:
        """根据 GitHub ID 获取用户"""
        return self.db.query(User).filter(User.github_id == github_id).first()

    @staticmethod
    def hash_password(password: str) -> str:
        """生成密码哈希"""
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """验证密码"""
        return pwd_context.verify(plain_password, hashed_password)

    def register(
        self,
        username: str,
        password: str,
        email: Optional[str] = None,
        name: Optional[str] = None,
    ) -> tuple[Optional[User], str]:
        """
        本地用户注册
        返回: (用户对象, 错误信息)
        """
        # 检查用户名是否已存在
        if self.get_by_username(username):
            return None, "用户名已存在"

        # 检查邮箱是否已存在
        if email and self.get_by_email(email):
            return None, "邮箱已被使用"

        # 创建用户
        user = User(
            id=str(uuid.uuid4()),
            username=username,
            password_hash=self.hash_password(password),
            name=name or username,
            email=email,
            auth_provider="local",
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user, ""

    def authenticate(self, username: str, password: str) -> tuple[Optional[User], str]:
        """
        本地用户认证
        返回: (用户对象, 错误信息)
        """
        user = self.get_by_username(username)
        if not user:
            return None, "用户名或密码错误"

        if not user.password_hash:
            return None, "该账户不支持密码登录"

        if not self.verify_password(password, user.password_hash):
            return None, "用户名或密码错误"

        return user, ""

    def create(self, data: UserCreate) -> User:
        """创建用户 (OAuth)"""
        user = User(
            id=data.id,
            name=data.name,
            email=data.email,
            avatar=data.avatar,
            auth_provider=data.provider,
            github_id=data.id if data.provider == "github" else None,
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

    def get_or_create_oauth(self, data: UserCreate) -> User:
        """获取或创建 OAuth 用户"""
        # GitHub 用户通过 github_id 查找
        if data.provider == "github":
            user = self.get_by_github_id(data.id)
            if user:
                return self.update(user, data)

        # 其他情况通过 id 查找
        user = self.get_by_id(data.id)
        if user:
            return self.update(user, data)

        return self.create(data)

    # 兼容旧方法名
    def get_or_create(self, data: UserCreate) -> User:
        return self.get_or_create_oauth(data)
