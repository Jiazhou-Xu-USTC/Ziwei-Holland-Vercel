import { NextResponse } from "next/server";
import iztro from "iztro";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

// --- Helper: 各种 prompt & fallback logic（完全保留你的原逻辑） ---
// （为了让你容易识别，我没有动逻辑，只把 require 改成 ES Module）


// ===== 霍兰德计算 =====
function calculateHollandScores(answers) {
    const questionMapping = {
        R: [0, 1, 2, 3],
        I: [4, 5, 6, 7],
        A: [8, 9, 10, 11],
        S: [12, 13, 14, 15],
        E: [16, 17, 18, 19],
        C: [20, 21, 22, 23]
    };

    const scores = {};
    for (const [type, idx] of Object.entries(questionMapping)) {
        scores[type] = idx.reduce((s, i) => s + (answers[i] || 0), 0);
    }
    return scores;
}

function analyzeHollandResult(scores) {
    const typeNames = {
        R: "现实型", I: "研究型", A: "艺术型",
        S: "社会型", E: "企业型", C: "常规型"
    };

    const sorted = Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .map(([type, score]) => ({ type, score, name: typeNames[type] }));

    const hollandCode = sorted.slice(0, 3).map(s => s.type).join("");

    return {
        hollandCode,
        scores,
        primaryType: sorted[0].type,
        primaryTypeName: sorted[0].name,
        primaryScore: sorted[0].score,
        sortedTypes: sorted,
        topThreeTypes: sorted.slice(0, 3)
    };
}


// ===== 紫微分析 =====
function getTimeIndex(hour, minute = 0) {
    const t = hour * 60 + minute;
    return Math.floor(((t + 60) % 1440) / 120);
}

async function generateZiweiAnalysis(data) {
    const { name, gender, birthYear, birthMonth, birthDay, birthHour, birthMinute } = data;
    const solarDate = `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`;
    const timeIndex = getTimeIndex(birthHour, birthMinute);

    const astrolabe = iztro.astro.bySolar(solarDate, timeIndex, gender === "女" ? "female" : "male", true, "zh-CN");

    const palaces = {};
    const palaceNames = ["命宫", "兄弟", "夫妻", "子女", "财帛", "疾厄", "迁移", "奴仆", "官禄", "田宅", "福德", "父母"];

    palaceNames.forEach(p => {
        const palace = astrolabe.palace(p);
        palaces[p] = {
            name: p,
            position: palace?.earthlyBranch || "",
            majorStars: (palace?.majorStars || []).map(s => s.name),
            minorStars: (palace?.minorStars || []).map(s => s.name)
        };
    });

    return {
        userInfo: {
            name,
            gender,
            solarDate: astrolabe.solarDate,
            lunarDate: astrolabe.lunarDate,
            chineseDate: astrolabe.chineseDate,
            zodiac: astrolabe.zodiac,
            fiveElementsClass: astrolabe.fiveElementsClass
        },
        palaces
    };
}


// ===== DeepSeek 统一调用函数 =====
async function callDeepSeek(prompt, max_tokens = 1500) {
    const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.4,
            max_tokens
        })
    });

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "DeepSeek 返回为空。";
}


// ===== Prompt 构建 =====
function buildCombinedPrompt(ziwei, holland, user) {
    return `
请综合以下两个维度信息，为用户提供专业方向、职业规划建议：

===== 【紫微斗数】 =====
性别：${user.gender}
八字：${ziwei.userInfo.chineseDate}
五行局：${ziwei.userInfo.fiveElementsClass}

命宫主星：${ziwei.palaces["命宫"].majorStars?.join("、")}

===== 【霍兰德职业测试】 =====
霍兰德代码：${holland.hollandCode}
排序：${holland.topThreeTypes.map(t => `${t.name}(${t.type})：${t.score}分`).join(" / ")}

===== 需要你输出 =====
1. 性格特质综合分析  
2. 天赋优势总结  
3. 推荐 5—8 个最适合的大学专业（必须给出理由）  
4. 推荐 5 个职业方向  
5. 长期发展路径  
6. 注意事项  
7. 紫微与霍兰德结果的一致性分析  

请写成一篇完整的报告，结构清晰、可读性强。
`.trim();
}


// ===== Main API Handler =====
export default async function handler(req) {
    if (req.method !== "POST") {
        return NextResponse.json({ success: false, message: "Method not allowed" }, { status: 405 });
    }

    try {
        const body = await req.json();
        const {
            name, gender, birthYear, birthMonth, birthDay, birthHour, birthMinute,
            hollandAnswers
        } = body;

        // === 1. Holland ===
        const scores = calculateHollandScores(hollandAnswers);
        const holland = analyzeHollandResult(scores);

        // === 2. Ziwei ===
        const ziwei = await generateZiweiAnalysis({
            name, gender, birthYear, birthMonth, birthDay, birthHour, birthMinute
        });

        // === 3. Combined DeepSeek ===
        const prompt = buildCombinedPrompt(ziwei, holland, { name, gender });
        const combinedAnalysis = await callDeepSeek(prompt, 2000);

        return NextResponse.json({
            success: true,
            data: {
                hollandResult: holland,
                ziweiAnalysis: ziwei,
                combinedAnalysis,
                timestamp: new Date().toISOString()
            }
        });

    } catch (err) {
        return NextResponse.json(
            { success: false, message: err.message || "unknown error" },
            { status: 500 }
        );
    }
}
