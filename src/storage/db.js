import initDB from './sqlite';

const db = {
  async init() {
    await initDB();
  },
};

export default db;