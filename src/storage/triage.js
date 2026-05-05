import initDB from './sqlite';

export const saveTriage = async (data) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'INSERT INTO triage (breathing, severe_bleeding, conscious, can_move, description, tag, reason, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          data.breathing ? 1 : 0,
          data.severeBleeding ? 1 : 0,
          data.conscious ? 1 : 0,
          data.canMove ? 1 : 0,
          data.description || '',
          data.tag || '',
          data.reason || '',
          data.timestamp || Date.now()
        ],
        (tx, result) => resolve(result),
        (tx, error) => {
          console.error('saveTriage error:', error);
          reject(error);
        }
      );
    });
  });
};

export const getTriageHistory = async (limit = 50) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'SELECT * FROM triage ORDER BY timestamp DESC LIMIT ?',
        [limit],
        (tx, results) => {
          const items = [];
          for (let i = 0; i < results.rows.length; i++) {
            items.push(results.rows.item(i));
          }
          resolve(items);
        },
        (tx, error) => {
          console.error('getTriageHistory error:', error);
          reject(error);
        }
      );
    });
  });
};

export const clearTriageHistory = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql('DELETE FROM triage', [], () => resolve(), (tx, error) => reject(error));
    });
  });
};