import couchdb

COUCH_URL = "http://admin:admin@127.0.0.1:5984/"

DB_NAME = "facial"

server = couchdb.Server(COUCH_URL)

if DB_NAME in server:
    db = server[DB_NAME]
else:
    db = server.create(DB_NAME)