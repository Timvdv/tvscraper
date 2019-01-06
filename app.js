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

const restartBrowser = async function() {
  try {
    await browser.close()
    await initBrowser();
  } catch(e) {
    console.log("Error inside error. Shit is really broken");
    console.log(e);
  }
}

let browser = null;

async function initBrowser() {
  browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true
  });
}

try {
  initBrowser();
  initRoutes();
} catch(e) {
  console.error("Could not launch browser");
}

function initRoutes() {
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
      if(!coin_symbol) {
        return res.json(json_response);
      }
  
      if (coin_symbol === "BTC") {
        coin_symbol = "BTCUSD";
      } else {
        coin_symbol = coin_symbol.toUpperCase() + "BTC";
      }

      console.log(coin_symbol);
  
      await page.goto(
        "https://www.tradingview.com/symbols/" + coin_symbol, {
          waitUntil: 'networkidle'
        }
      );

      const ideas_mapped = await page.$$eval(
        ".tv-widget-idea.js-widget-idea",
        idea_node_list => {
            const ideas = [...idea_node_list];

            return ideas.map(idea => {
              return {
                title: idea.querySelector(".tv-widget-idea__title").innerHTML,
                image: idea.querySelectorAll(".tv-widget-idea__cover-link img")[0] && idea.querySelectorAll(".tv-widget-idea__cover-link img")[0].src,
                date: idea.querySelector(".tv-card-stats__time").attributes["data-timestamp"].value,
                content: idea.querySelector(".tv-widget-idea__description-text").innerHTML,
                uploader: idea.querySelector(".tv-card-user-info__name").innerHTML,
                target: idea.querySelectorAll("a.tv-widget-idea__title")[0] && idea.querySelectorAll("a.tv-widget-idea__title")[0].href,
                upvotes: parseInt(idea.querySelector(".tv-card-social-item__count").innerHTML),
                comments: parseInt(idea.querySelector(".tv-card-social-item__count").innerHTML),
                views: parseInt(idea.querySelector(".tv-card-stats__views").innerText),
                prediction: idea.querySelector(".tv-card-label") && idea.querySelector(".tv-card-label").innerText,
              }
            });
        });

      await page.goto(
        `https://www.tradingview.com/symbols/${coin_symbol}/technicals/`, {
          waitUntil: 'networkidle'
        }
      );

      await page.waitFor(() => !!document.querySelector("[class^='counterNumber']"));

      const recommendation = await page.$$eval("[class^='speedometerSignal']", el => el[1] && el[1].textContent)

      const sell = await page.$$eval(
        "[class^='counterNumber']",
        el => el[3] && el[3].textContent
      );

      const neutral = await page.$$eval(
        "[class^='counterNumber']",
        el => el[4] && el[4].textContent
      );

      const buy = await page.$$eval(
        "[class^='counterNumber']",
        el => el[5] && el[5].textContent
      );

      json_response = {
        recommendation,
        sell,
        neutral,
        buy,
        ideas_mapped
      };

      await page.close();

    } catch(e) {
      console.log(e);
      page.close();

      restartBrowser();
    }
  
    return res.json(json_response);
  });
}

app.listen(port, function () {
  console.log("App listening on port " + port);
});

var cleanExit = function () {
  browser.close()
  process.exit()
};

process.on('SIGINT', cleanExit); // catch ctrl-c
process.on('SIGTERM', cleanExit); // catch kill
