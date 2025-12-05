import { NextResponse } from "next/server";

// DeepSeek
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

// iztro
import iztro from "iztro";

// Helper: 时辰换算
function getTimeIndex(hour, minute = 0) {
    const totalMinutes = hour * 60 + minute;
    return Math.floor(((totalMinutes + 60) % 1440) / 120);
}

export default async function handler(req) {
    if (req.method !== "POST") {
        return NextResponse.json({ success: false, message: "Method not allowed" }, { status: 405 });
    }

    try {
        const requestData = await req.json();
        const {
            name,
            gender,
            birthYear,
            birthMonth,
            birthDay,
            birthHour,
            birthMinute = 0,
            location
        } = requestData;

        if (!gender || !birthYear || !birthMonth || !birthDay || birthHour === undefined) {
            return NextResponse.json(
                { success: false, message: "缺少必需参数" },
                { status: 400 }
            );
        }

        // ====== IZTRO 排盘 ======
        const timeIndex = getTimeIndex(birthHour, birthMinute);
        const genderParam = gender === "女" ? "female" : "male";

        const solarDateStr = `${birthYear}-${birthMonth}-${birthDay}`;
        const astrolabe = iztro.astro.bySolar(solarDateStr, timeIndex, genderParam, true, "zh-CN");

        if (!astrolabe) throw new Error("IZTRO排盘失败");

        const userInfo = {
            name: name || "用户",
            gender,
            solarDate: astrolabe.solarDate,
            lunarDate: astrolabe.lunarDate,
            chineseDate: astrolabe.chineseDate,
            zodiac: astrolabe.zodiac,
            fiveElementsClass: astrolabe.fiveElementsClass
        };

        // 宫位
        const palaces = {};
        const palaceNames = ["命宫", "兄弟", "夫妻", "子女", "财帛", "疾厄", "迁移", "奴仆", "官禄", "田宅", "福德", "父母"];

        palaceNames.forEach((p) => {
            const palace = astrolabe.palace(p);
            palaces[p] = {
                name: p,
                position: palace?.earthlyBranch || "",
                majorStars: (palace?.majorStars || []).map(s => s.name),
                minorStars: (palace?.minorStars || []).map(s => s.name)
            };
        });

        // ====== DeepSeek ======
        const prompt = `
作为紫微斗数分析师，请根据排盘信息分析性格、天赋和专业建议。

【基本信息】
性别：${gender}
生辰八字：${userInfo.chineseDate}

【宫位】
${Object.keys(palaces).map(
    k => `${k}：${palaces[k].position}\n主星：${palaces[k].majorStars.join("、")}`
).join("\n")}
`;

        const deepseekResponse = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 800
            })
        });

        const deepseekData = await deepseekResponse.json();

        const deepseekAnalysis =
            deepseekData.choices?.[0]?.message?.content || "DeepSeek返回为空";

        // ====== 返回 ======
        return NextResponse.json({
            success: true,
            data: {
                userInfo,
                palaces,
                deepseekAnalysis
            }
        });

    } catch (err) {
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    }
}
