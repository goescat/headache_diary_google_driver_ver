# headache_diary_google_driver_ver

### 安裝
```
pip install -r requirements.txt
```
### key 放到 .env
```
FLASK_ENV=development
FLASK_DEBUG=1
GOOGLE_CLIENT_ID=required （你的 key
DRIVE_FILE_ID_KEY=required （你的 key
```
### local 啟動
作為 Demo google oauth, 要在 127.0.0.1:8000 才允許已授權的重新導向 URI
```
python app.py
```
