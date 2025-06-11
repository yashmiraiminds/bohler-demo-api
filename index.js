const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const csv = require("csv-parser");
const stringSimilarity = require("string-similarity");

const app = express();

app.use(cors());
const PORT = 3338;

// Middleware to parse JSON
app.use(bodyParser.json());

function normalizeName(name) {
  return name.toLowerCase().replace(/[\s-]/g, "");
}

function getMostSimilarProduct(productName, callback) {
  const results = [];

  try {
    fs.createReadStream("bohler1.csv")
      .pipe(
        csv({
          mapHeaders: ({ header }) => header.trim().toLowerCase(),
        }),
      )
      .on("data", (data) => results.push(data))
      .on("end", () => {
        const inputNormalized = normalizeName(productName);

        const productNames = results.map((row) =>
          normalizeName(row["product name"]),
        );
        const originalNames = results.map((row) => row["product name"]);

        const match = stringSimilarity.findBestMatch(
          inputNormalized,
          productNames,
        );

        const bestMatchIndex = match.bestMatchIndex;
        const bestMatchProduct = results[bestMatchIndex];

        if (bestMatchProduct) {
          callback({
            matchedProduct: bestMatchProduct["product name"],
            link: bestMatchProduct["product sheet link"],
            rating: match.bestMatch.rating.toFixed(2),
          });
        } else {
          callback({ error: "No similar product found." });
        }
      });
  } catch (e) {
    console.log(e);
  }
}

app.post("/send_mail", async (req, res) => {
  try {
    let productName =
      req.body.message.toolCallList[0].function.arguments.productName;

    console.log({ productName });

    getMostSimilarProduct(productName, async (result) => {
      if (result.error) {
        console.log(result.error);
        return res.status(404).json({ message: "Product not found." });
      }

      const matchedName = result.matchedProduct.replace(/-/g, "");
      const sheetLink = result.link;

      const transporter = nodemailer.createTransport({
        service: "Gmail",
        port: 587,
        secure: false,
        auth: {
          user: "kandarp@miraiminds.co",
          pass: "knkwlzqncbiwjuex", // App password
        },
        family: 6,
        debug: true,
        logger: true,
      });

      const mailOptions = {
        from: '"Bohler Welding" <kandarp@miraiminds.co>',
        to: "sek@miraiminds.co",
        subject: `${matchedName} - Product Data Sheet`,
        html: `<p><strong>Product Name:</strong> ${matchedName}</p><p><strong>Product Data Sheet Link:</strong> ${sheetLink}</p>`,
      };

      try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "Email sent successfully." });
      } catch (err) {
        res
          .status(500)
          .json({ message: "Email sending failed.", error: err.message });
      }
    });
  } catch (e) {
    console.log(e);
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
