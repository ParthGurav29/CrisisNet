import SQLite from 'react-native-sqlite-storage';
import { Platform } from 'react-native';

const DB_NAME = 'crisisnet.db';

let db = null;
let initPromise = null;

export const initDB = () => {
  if (db) return db;
  
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    // Use 'default' location which works on both iOS and Android
    // This places the database in the app's sandbox directory
    const dbConfig = { 
      name: DB_NAME, 
      location: 'default',
      createFromCopy: false 
    };

    db = SQLite.openDatabase(
      dbConfig,
      () => {
        // Create tables after open
        db.transaction((tx) => {
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS messages (
              id TEXT PRIMARY KEY,
              sender TEXT,
              text TEXT,
              timestamp INTEGER,
              type TEXT,
              color TEXT,
              triage TEXT
            )`,
            [],
            () => {},
            (t, error) => console.error('messages table error:', error)
          );

          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS triage (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              breathing INTEGER,
              severe_bleeding INTEGER,
              conscious INTEGER,
              can_move INTEGER,
              description TEXT,
              tag TEXT,
              reason TEXT,
              timestamp INTEGER
            )`,
            [],
            () => {},
            (t, error) => console.error('triage table error:', error)
          );
        });
        resolve(db);
      },
      (error) => {
        console.error('SQLite init error:', error);
        reject(error);
      }
    );
  });

  return initPromise;
};

export const closeDB = () => {
  if (db) {
    db.close();
    db = null;
    initPromise = null;
  }
};

export default initDB;