import os
from dotenv import load_dotenv

print("Additional Settings being applied.")
relative_path = os.path.join(os.path.dirname(__file__), 'reactapp', 'config', 'development.env')
dotenv_path = os.path.abspath(relative_path)
load_dotenv(dotenv_path, override=True)

SESSION_SECURITY_WARN_AFTER = int(os.getenv('REACT_SESSION_SECURITY_WARN_AFTER'))
SESSION_SECURITY_EXPIRE_AFTER = int(os.getenv('REACT_SESSION_SECURITY_EXPIRE_AFTER'))
