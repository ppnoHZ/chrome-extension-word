"""
数据同步服务
"""
from sqlalchemy.orm import Session

from app.models import User, Category, Word, Collection
from app.schemas.sync import SyncData
from app.schemas.category import CategorySchema
from app.schemas.word import WordSchema
from app.schemas.collection import CollectionSchema


class SyncService:
    """数据同步业务逻辑"""

    def __init__(self, db: Session):
        self.db = db

    def upload(self, user: User, data: SyncData) -> tuple[bool, str]:
        """
        上传同步数据（全量覆盖）
        """
        try:
            # 删除用户现有数据
            self.db.query(Collection).filter(Collection.user_id == user.id).delete()
            self.db.query(Word).filter(Word.user_id == user.id).delete()
            self.db.query(Category).filter(Category.user_id == user.id).delete()

            # 导入分类
            for cat in data.categories:
                db_cat = Category(
                    id=cat.id,
                    user_id=user.id,
                    name=cat.name,
                    color=cat.color,
                )
                self.db.add(db_cat)

            # 导入单词
            for word in data.words:
                db_word = Word(
                    user_id=user.id,
                    text=word.text,
                    category_id=word.categoryId,
                    added_at=word.addedAt,
                )
                self.db.add(db_word)

            # 导入收藏
            for col in data.collections:
                db_col = Collection(
                    id=col.id,
                    user_id=user.id,
                    text=col.text,
                    category_id=col.categoryId,
                    source_url=col.sourceUrl,
                    source_title=col.sourceTitle,
                    context=col.context,
                    collected_at=col.collectedAt,
                )
                self.db.add(db_col)

            self.db.commit()

            return True, (
                f"同步成功: {len(data.categories)} 个分类, "
                f"{len(data.words)} 个单词, "
                f"{len(data.collections)} 个收藏"
            )
        except Exception as e:
            self.db.rollback()
            return False, f"同步失败: {str(e)}"

    def download(self, user: User) -> SyncData:
        """
        下载用户已同步的数据
        """
        categories = self.db.query(Category).filter(Category.user_id == user.id).all()
        words = self.db.query(Word).filter(Word.user_id == user.id).all()
        collections = self.db.query(Collection).filter(Collection.user_id == user.id).all()

        return SyncData(
            categories=[
                CategorySchema(id=c.id, name=c.name, color=c.color)
                for c in categories
            ],
            words=[
                WordSchema(text=w.text, categoryId=w.category_id, addedAt=w.added_at)
                for w in words
            ],
            collections=[
                CollectionSchema(
                    id=c.id,
                    text=c.text,
                    categoryId=c.category_id,
                    sourceUrl=c.source_url,
                    sourceTitle=c.source_title,
                    context=c.context,
                    collectedAt=c.collected_at,
                )
                for c in collections
            ],
        )
