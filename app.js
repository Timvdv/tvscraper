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
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true
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
      "BTC/", {
        waitUntil: 'networkidle'
      }
    );

    // console.log(page_url);

    let page_response = await page
      .waitFor("span.tv-widget-technicals__counter-number")
      .then(async () => {

        // Delay is needed for TA valves to render on Heroku
        await delay(200);

        // Get the "viewport" of the page, as reported by the page.
        json_response = await page.evaluate(() => {

          const idea_node_list = document.querySelectorAll(".tv-widget-idea.tv-site-widget__body");
          const ideas = [...idea_node_list];

          const ideas_mapped = ideas.map(idea => {
            return {
              title: idea.querySelectorAll(".tv-widget-idea__title-name")[0] && idea.querySelectorAll(".tv-widget-idea__title-name")[0].innerHTML,
              image: idea.querySelectorAll(".tv-widget-idea__cover-link img")[0] && idea.querySelectorAll(".tv-widget-idea__cover-link img")[0].src,
              date: idea.querySelectorAll(".tv-widget-idea__time")[0] && idea.querySelectorAll(".tv-widget-idea__time")[0].attributes["data-timestamp"] && idea.querySelectorAll(".tv-widget-idea__time")[0].attributes["data-timestamp"].value,
              content: idea.querySelectorAll(".tv-widget-idea__description-text")[0] && idea.querySelectorAll(".tv-widget-idea__description-text")[0].innerHTML,
              uploader: idea.querySelectorAll(".tv-user-link__name")[0] && idea.querySelectorAll(".tv-user-link__name")[0].innerHTML,
              target: idea.querySelectorAll("a.tv-widget-idea__title")[0] && idea.querySelectorAll("a.tv-widget-idea__title")[0].href,
              upvotes: idea.querySelectorAll(".tv-social-stats__count")[2] && idea.querySelectorAll(".tv-social-stats__count")[2].innerHTML,
              comments: idea.querySelectorAll(".tv-social-stats__count")[1] && idea.querySelectorAll(".tv-social-stats__count")[1].innerHTML,
              views: idea.querySelectorAll(".tv-social-stats__count")[0] && idea.querySelectorAll(".tv-social-stats__count")[0].innerHTML,
              prediction: idea.querySelectorAll(".tv-idea-label")[0] && idea.querySelectorAll(".tv-idea-label")[0].innerHTML,
            }
          });

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
            )[2].textContent,
            ideas_mapped
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
