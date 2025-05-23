import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import readlineSync from "readline-sync";
import { configDotenv } from "dotenv";
import fetch from "node-fetch";
import { getJson } from "serpapi";

configDotenv();

const api_key = process.env.google_api_key;
const api_key_2 = process.env.ip_api_key;


async function city() {
  const options = {
    method: "GET",
    headers: { accept: "application/json" },
  };

  try {
    const response = await fetch(
      `http://api.ipapi.com/api/check?access_key=${api_key_2}`,
      options
    );
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const location = await response.json();
    return location.region_name;
  } catch (err) {
    console.error("Error fetching location data:", err);
    return null;
  }
}


async function getNews(city) {
  return new Promise((resolve, reject) => {
    getJson(
      {
        engine: "google_news",
        q: `${city}`,
        hl: "en",
        api_key: process.env.news_api_key,
      },
      (json) => {
        if (json && json.news_results) {
          resolve(json.news_results);
        } else {
          reject("No news results found");
        }
      }
    );
  });
}

function colorizeMarkdown(text) {
  return text
    .replace(/### 📰 Top Stories/g, "\x1b[35m📰 Top Stories\x1b[0m")
    .replace(/### 🏛 Politics/g, "\x1b[36m🏛 Politics\x1b[0m")
    .replace(/### 🌦 Weather/g, "\x1b[33m🌦 Weather\x1b[0m")
    .replace(/### 🎭 Local Events/g, "\x1b[34m🎭 Local Events\x1b[0m")
    .replace(/### 🏀 Sports/g, "\x1b[32m🏀 Sports\x1b[0m")
    .replace(/🔍 Highlight of the Day:/g, "\x1b[41m\x1b[97m🔍 Highlight of the Day:\x1b[0m")
    .replace(/\*\*(.*?)\*\*/g, "\x1b[1m$1\x1b[0m")
    .replace(/\(source: ([^)]+)\)/g, "\x1b[2m(source: $1)\x1b[0m")
    .replace(/(https?:\/\/[^\s]+)/g, "\x1b[4m$1\x1b[0m");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function printLineByLine(content, delayMs = 80) {
  const lines = content.split("\n");
  for (const line of lines) {
    console.log(line);
    await delay(delayMs);
  }
}

const messageHistory = [
  new SystemMessage(
    `You are an AI news reporter named "CityScope", and your job is to summarize the most important news updates for a specific city in a professional, concise, and informative way.

    The news data is provided in JSON format. Each item contains:
      - "title": The headline of the news
      - "description": A short description (if available)
      - "source": News source name
      - "publishedAt": The timestamp of the article
      - "url": The full article link

    TASK:
      1. Read the list of articles carefully.
      2. Group related headlines (e.g., politics, sports, environment).
      3. Create a structured **daily bulletin** that includes:
        - 📍 City name and today's date
        - 📰 Sectioned bullet points (e.g., "Top Stories", "Politics", "Weather", "Local Events", "Sports")
        - Each bullet should include the **headline**, a brief 1-2 line summary, and (source).
        - If possible, include 1 "🔍 Highlight of the Day" - the most important or impactful story with extra detail.
        - End with a closing note like: "Stay informed. See you tomorrow!"

    Format your response clearly.
    If the user asks any questions based on the news, respond using the news data.
    If the user deviates from the topic, politely bring them back to news.`
  ),
];


const model = new ChatGoogleGenerativeAI({
  modelName: "gemini-2.0-flash",
  maxOutputTokens: 2048,
  apiKey: api_key,
});


async function print(msg) {
  messageHistory.push(new HumanMessage(msg));
  try {
    const response = await model.invoke(messageHistory);
    const colorized = colorizeMarkdown(response.content);
    console.log("\n\x1b[34mAI:\x1b[0m\n");
    await printLineByLine(colorized, 80);
    messageHistory.push(new HumanMessage(response.content));
  } catch (error) {
    console.error("Error:", error.message);
  }
}


async function runConversation() {
  console.log("\x1b[36mChatbot Started...\x1b[0m");

  const report = await city();
  if (!report) {
    console.log("Could not get city from IP.");
    return;
  }

  let newsJson;
  try {
    newsJson = await getNews(report);
  } catch (err) {
    console.error("Failed to fetch news:", err);
    return;
  }

  await print(`City is ${report}. News JSON: ${JSON.stringify(newsJson)}`);

  while (true) {
    const userInput = readlineSync.question("You: ");
    if (userInput.toLowerCase() === "exit") {
      break;
    }
    await print(userInput);
  }

  console.log("\x1b[36mChatbot Ended...\x1b[0m");
}

runConversation();
