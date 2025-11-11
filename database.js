// database.js (mock temporar)
export default {
  async initializeDatabase() {
    console.log("Database initialized (mock)");
  },
  async getLicense() {
    return null;
  },
  async checkLicenseStatus() {
    return { valid: false, reason: "mock" };
  },
  async activateLicense() {
    return { code: "mock", type: "BASIC" };
  },
  async incrementQuestionUsage() {
    return { questions_used: 0, questions_total: 0 };
  },
  async createLicense() {
    return { code: "mock", type: "BASIC" };
  },
  async getAllLicenses() {
    return [];
  },
};
