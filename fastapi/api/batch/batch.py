import os
import time
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database connection settings
MYSQL_USER = os.getenv("MYSQL_USER")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD")
MYSQL_HOST = "db"  # Service name set in your YAML or Docker Compose file
MYSQL_DATABASE = "debate"

PROD_DB_URL = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}/{MYSQL_DATABASE}?charset=utf8"
DEV_DB_URL = "mysql+pymysql://root:@db:3306/debate?charset=utf8"
DB_URL = PROD_DB_URL if os.getenv("ENV") == "production" else DEV_DB_URL

# Create SQLAlchemy engine
engine = create_engine(DB_URL, echo=True)

def wait_for_db_connection(max_retries=5, wait_interval=5):
    """Retry database connection."""
    retries = 0
    while retries < max_retries:
        try:
            engine.connect()
            print("Database connection successful.")
            return True
        except OperationalError as e:
            retries += 1
            print(f"Database connection failed ({e}). Retrying in {wait_interval} seconds...")
            time.sleep(wait_interval)
    print("Could not connect to the database. Exiting.")
    return False

def check_if_data_exists(table_name):
    """Check if data exists in the specified table."""
    try:
        with engine.connect() as connection:
            result = connection.execute(text(f"SELECT 1 FROM `{table_name}` LIMIT 1")).fetchone()
            return result is not None
    except Exception as e:
        print(f"Failed to check data existence: {e}")
        return False

def escape_sql_file(file_path):
    """Escape single quotes in SQL file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            sql_script = file.read()

        # Escape single quotes
        escaped_script = sql_script.replace("'", "''")

        # Write the modified SQL file
        with open(file_path, 'w', encoding='utf-8') as file:
            file.write(escaped_script)

        print(f"SQL file '{file_path}' escaped successfully.")
    except Exception as e:
        print(f"Failed to escape SQL file: {e}")

def execute_sql_statements(file_path):
    """Execute SQL statements in SQL file."""
    try:
        with engine.raw_connection() as conn:
            with conn.cursor() as cursor:
                with open(file_path, 'r', encoding='utf-8') as file:
                    sql_script = file.read()

                # Split the SQL script into individual statements
                statements = sql_script.split(';')

                for statement in statements:
                    statement = statement.strip()
                    if statement:
                        try:
                            cursor.execute(statement)
                        except Exception as e:
                            print(f"Failed to execute statement: {statement}\nError: {e}")
                conn.commit()
            print(f"SQL statements from '{file_path}' executed successfully.")
    except Exception as e:
        print(f"Failed to execute SQL statements: {e}")

if __name__ == "__main__":
    sql_file_path = "batch/debate.sql"  # Path to your SQL file

    # Escape single quotes in the SQL file (optional)
    # escape_sql_file(sql_file_path)  # Uncomment if needed

    if wait_for_db_connection():
        table_name = "argument_units"  # Table name to check

        # Execute SQL statements only if data does not exist
        if not check_if_data_exists(table_name):
            print(f"No data found in '{table_name}'. Executing SQL statements...")
            execute_sql_statements(sql_file_path)
        else:
            print(f"Data already exists in '{table_name}'. Skipping SQL execution.")
    else:
        print("Exiting due to database connection failure.")
