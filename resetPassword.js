const bcrypt = require("bcrypt");

async function reset() {
  const hash = await bcrypt.hash("Admin123@", 10);
  console.log(hash);
}

reset();