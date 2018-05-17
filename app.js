const express = require("express");
const app = express();
const puppeteer = require("puppeteer");
const port = process.env.PORT || 8080;

var parseUrl = function (url) {
  url = decodeURIComponent(url);
  if (!/^(?:f|ht)tps?\:\/\//.test(url)) {
    url = "http://" + url;
  }

  return url;
};

const delay = function (timeout) {
  return new Promise(resolve => {
    setTimeout(resolve, timeout);
  });
};

let browser = null;

async function initBrowser() {
  browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
}

initBrowser();


app.get("/", async (req, res) => {
  var coin_symbol = req.query.coin_symbol;

  // This will be overwritten if everything goes as planned.
  let json_response = {
    error: true,
    message: "something went wrong"
  };

  if (!browser) {
    throw new Error("Browser not active");
  }

  let page = await browser.newPage();

  try {

    if (coin_symbol === "BTC") {
      coin_symbol = "USDT";
    }

    let page_url = await page.goto(
      "https://www.tradingview.com/symbols/" +
      coin_symbol.toUpperCase() +
      "BTC/"
    );

    // console.log(page_url);

    let page_response = await page
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

    // console.log(page_response);

    page.close();

  } catch (e) {
    page.close();

    await browser.close()

    initBrowser();

    console.log(e.message);
  }

  return res.json(json_response);
});

app.listen(port, function () {
  console.log("App listening on port " + port);
});

var cleanExit = function () {
  browser.close()
  process.exit()
};
process.on('SIGINT', cleanExit); // catch ctrl-c
process.on('SIGTERM', cleanExit); // catch kill
