import initDB from './sqlite';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 100;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const saveMessage = async (message, retryCount = 0) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'INSERT INTO messages (id, sender, text, timestamp, type, color, triage) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING',
        [message.id, message.sender, message.text, message.timestamp, message.type, message.color || null, message.triage || null],
        () => resolve(message),
        (tx, error) => {
          console.error('saveMessage error:', error);
          if (retryCount < MAX_RETRIES) {
            sleep(RETRY_DELAY_MS).then(() => {
              saveMessage(message, retryCount + 1).then(resolve).catch(reject);
            });
          } else {
            reject(error);
          }
        }
      );
    });
  });
};

export const getMessages = async (retryCount = 0) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql('SELECT * FROM messages ORDER BY timestamp ASC', [], (tx, results) => {
        const messages = [];
        for (let i = 0; i < results.rows.length; i++) {
          messages.push(results.rows.item(i));
        }
        resolve(messages);
      }, (tx, error) => {
        console.error('getMessages error:', error);
        if (retryCount < MAX_RETRIES) {
          sleep(RETRY_DELAY_MS).then(() => {
            getMessages(retryCount + 1).then(resolve).catch(reject);
          });
        } else {
          reject(error);
        }
      });
    });
  });
};

export const clearMessages = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql('DELETE FROM messages', [], () => resolve(), (tx, error) => {
        console.error('clearMessages error:', error);
        reject(error);
      });
    });
  });
};

export const cleanupMessages = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'DELETE FROM messages WHERE id NOT IN (SELECT id FROM messages ORDER BY timestamp DESC LIMIT 500)',
        [],
        () => resolve(),
        (tx, error) => {
          console.error('cleanupMessages error:', error);
          reject(error);
        }
      );
    });
  });
};