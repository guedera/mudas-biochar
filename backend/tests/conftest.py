import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


@pytest.fixture()
def sessionmaker_():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return sessionmaker(autoflush=False, bind=engine)


@pytest.fixture()
def client(sessionmaker_):
    from fastapi.testclient import TestClient

    def override_get_db():
        db = sessionmaker_()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    # Not using `with TestClient(app)` on purpose: that would trigger the
    # app's lifespan, which creates tables against the *real* database
    # engine instead of the in-memory one set up above.
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def db_session(sessionmaker_) -> Session:
    """Sessão ligada ao mesmo banco em memória usado pelo `client` — só para
    inserir dados que a API não permite controlar diretamente (ex.
    `data_medicao` no passado, usado nos testes de evolução no tempo)."""
    db = sessionmaker_()
    try:
        yield db
    finally:
        db.close()
