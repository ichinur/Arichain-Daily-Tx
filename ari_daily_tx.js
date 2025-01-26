const axios = require('axios');
const qs = require('qs');
const fs = require("fs");
const chalk = require('chalk');

// Konstanta
const LOOP_INTERVAL = 24 * 60 * 60 * 1000; // 24 jam dalam milidetik
const TRANSACTION_DELAY = 1000; // Delay 1 detik antara transaksi

// Fungsi untuk membaca alamat penerima dari penerima.txt
function getRecipientAddresses() {
  try {
    const file = fs.readFileSync('./penerima.txt', 'utf-8');
    const addresses = file
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '');
    return addresses;
  } catch (error) {
    console.error(chalk.red('Gagal membaca penerima.txt:', error.message));
    process.exit(1);
  }
}

// Kelas untuk interaksi API
class AriChain {
  async transferToken(email, toAddress, password, amount = 1) {
    const headers = {
      'Accept': '*/*',
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    const transferData = qs.stringify({
      email,
      to_address: toAddress,
      pw: password,
      amount,
    });
    try {
      const response = await axios.post('https://arichain.io/api/wallet/transfer_mobile', transferData, { headers });
      return response.data;
    } catch (error) {
      console.error(chalk.red(`Transfer ke ${toAddress} gagal: ${error.message}`));
      if (error.response) {
        console.error(chalk.red('Response status:', error.response.status));
        console.error(chalk.red('Response data:', JSON.stringify(error.response.data, null, 2)));
      }
      return { status: 'fail', msg: error.message };
    }
  }
}

// Fungsi delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fungsi utama
(async () => {
  console.log(chalk.green("=== Auto Tx Daily Airchain ===\n"));

  const recipientAddresses = getRecipientAddresses();
  console.log(chalk.magenta(`[ Total ${recipientAddresses.length} Recipient Addresses ]\n`));

  let users;
  try {
    const file = fs.readFileSync('./data.txt', 'utf-8');
    users = file
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '')
      .map(line => line.split(':').map(part => part.trim()))
      .filter(parts => parts.length >= 3)
      .map(parts => ({
        email: parts[0],
        password: parts[1],
        address: parts[2],
      }));
  } catch (error) {
    console.error(chalk.red('Gagal membaca data.txt:', error.message));
    process.exit(1);
  }

  console.log(chalk.magenta(`[ Total ${users.length} Users ]\n`));

  const arichain = new AriChain();

  while (true) {
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(chalk.green(`Processing User ${i + 1} of ${users.length}`));
      console.log(chalk.yellow(`- Email: ${user.email}`));
      console.log(chalk.yellow(`- Address: ${user.address}\n`));

      // Validasi alamat pengirim
      if (!/^ARW[a-zA-Z0-9]{50}$/.test(user.address)) {
        console.log(chalk.red(`Alamat pengirim invalid untuk User ${i + 1}. Melewati...\n`));
        continue;
      }

      for (let j = 0; j < recipientAddresses.length; j++) {
        const recipientAddress = recipientAddresses[j];
        console.log(chalk.green(`Transferring to ${recipientAddress}...`));

        const transferResult = await arichain.transferToken(
          user.email,
          recipientAddress,
          user.password,
          1 // Jumlah token yang akan ditransfer
        );

        if (transferResult.status === 'success') {
          console.log(chalk.green(`Transfer to ${recipientAddress}: ${transferResult.result}\n`));
        } else {
          console.log(chalk.red(`Transfer to ${recipientAddress}: Failed - ${transferResult.msg}\n`));
        }

        // Delay 1 detik antara transaksi
        await delay(TRANSACTION_DELAY);
      }
    }

    console.log(chalk.yellow(`Waiting for 24 Hours before the next batch of transactions...\n`));
    await delay(LOOP_INTERVAL);
  }
})();
