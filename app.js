const express = require("express");
const app = express();
const puppeteer = require("puppeteer");
const port = process.env.PORT || 8080;

var parseUrl = function(url) {
  url = decodeURIComponent(url);
  if (!/^(?:f|ht)tps?\:\/\//.test(url)) {
    url = "http://" + url;
  }

  return url;
};

const delay = function(timeout) {
  return new Promise(resolve => {
    setTimeout(resolve, timeout);
  });
};

app.get("/", async (req, res) => {
  var coin_symbol = req.query.coin_symbol;

  // This will be overwritten if everything goes as planned.
  let json_response = {
    error: true,
    message: "something went wrong"
  };

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();

    if (coin_symbol === "BTC") {
      coin_symbol = "USDT";
    }

    await page.goto(
      "https://www.tradingview.com/symbols/" +
        coin_symbol.toUpperCase() +
        "BTC/"
    );

    await page
      .waitFor("span.tv-widget-technicals__counter-number")
      .then(async () => {
        await delay(200);
        // Get the "viewport" of the page, as reported by the page.
        json_response = await page.evaluate(() => {
          console.log(document);
          return {
            recommendation: document.querySelector(
              ".tv-widget-technicals__signal-title"
            ).textContent,
            sell: document.querySelectorAll(
              "span.tv-widget-technicals__counter-number"
            )[0].textContent,
            neutral: document.querySelectorAll(
              "span.tv-widget-technicals__counter-number"
            )[1].textContent,
            buy: document.querySelectorAll(
              "span.tv-widget-technicals__counter-number"
            )[2].textContent
          };
        });
      });

    await browser.close();
  } catch (e) {
    console.log(e.message);
    await browser.close();
  }

  return res.json(json_response);
});

app.listen(port, function() {
  console.log("App listening on port " + port);
});
