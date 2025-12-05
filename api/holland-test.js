import { NextResponse } from "next/server";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

// 默认分析函数保持你的原样
function generateDefaultHollandAnalysis(scores, primaryTypes, hollandCode) {
    const typeInfo = {
        R: { name: '现实型', traits: '动手能力强、注重实际、喜欢机械操作', careers: '工程师、技师、建筑师' },
        I: { name: '研究型', traits: '逻辑思维强、喜欢分析、追求真理', careers: '科研人员、医生、分析师' },
        A: { name: '艺术型', traits: '创造力强、想象丰富、重视美感', careers: '设计师、艺术家、作家' },
        S: { name: '社会型', traits: '人际能力强、喜欢帮助他人、有同理心', careers: '教师、心理咨询师、社工' },
        E: { name: '企业型', traits: '领导能力强、善于组织、追求成就', careers: '管理者、销售员、企业家' },
        C: { name: '常规型', traits: '做事有条理、细心负责、喜欢稳定', careers: '会计师、秘书、图书管理员' }
    };

    const primaryType = primaryTypes[0].type;
    const primaryInfo = typeInfo[primaryType];

    return {
        content: `## 霍兰德职业兴趣测试分析报告

### 您的霍兰德代码：${hollandCode}

### 主要兴趣类型：${primaryInfo.name}
特征：${primaryInfo.traits}

### 各维度得分
${Object.entries(scores).map(([type, score]) => 
    `- ${typeInfo[type].name}(${type})：${score}分`
).join('\n')}

### 推荐专业方向
${primaryTypes.slice(0, 3).map(item => 
    `${item.type === primaryType ? '🌟' : '⭐'} ${typeInfo[item.type].careers}`
).join('\n')}

### 发展建议
1. 发挥优势，重点发展主要维度能力
2. 通过实习体验验证职业兴趣
3. 综合考虑兴趣、能力和就业市场

（自动生成的简化版本）`,
        model: 'default-holland-analysis',
        timestamp: new Date().toISOString()
    };
}

export default async function handler(req) {
    if (req.method !== "POST") {
        return NextResponse.json(
            { success: false, message: "Method not allowed" },
            { status: 405 }
        );
    }

    try {
        console.log("收到霍兰德测试请求");

        const requestData = await req.json();
        const { answers, userInfo } = requestData;

        if (!answers || !Array.isArray(answers) || answers.length !== 24) {
            return NextResponse.json(
                { success: false, message: "霍兰德测试需要24道题的完整答案" },
                { status: 400 }
            );
        }

        // ====== 1. 计算霍兰德分数 ======
        console.log("开始计算霍兰德分数");

        const questionMapping = {
            R: [0, 1, 2, 3],
            I: [4, 5, 6, 7],
            A: [8, 9, 10, 11],
            S: [12, 13, 14, 15],
            E: [16, 17, 18, 19],
            C: [20, 21, 22, 23]
        };

        const scores = {};
        for (const [type, indices] of Object.entries(questionMapping)) {
            scores[type] = indices.reduce((sum, index) => sum + (answers[index] || 0), 0);
        }

        const sortedTypes = Object.entries(scores)
            .sort(([, a], [, b]) => b - a)
            .map(([type, score]) => ({ type, score }));

        const primaryTypes = sortedTypes.slice(0, 3);
        const hollandCode = primaryTypes.map(t => t.type).join("");

        console.log("霍兰德分数:", scores);

        // ====== 2. DeepSeek 大模型分析 ======
        const typeDescriptions = {
            R: '现实型 - 喜欢动手、工具、机械设备',
            I: '研究型 - 喜欢分析、逻辑和探索',
            A: '艺术型 - 喜欢创作和表达',
            S: '社会型 - 喜欢沟通和助人',
            E: '企业型 - 喜欢组织、领导、管理',
            C: '常规型 - 喜欢秩序、细致和规则'
        };

        const prompt = `
作为职业规划师，请根据霍兰德测试分析用户职业兴趣：

【霍兰德代码】${hollandCode}
【得分】
${Object.entries(scores).map(([type, score]) =>
    `${type} (${typeDescriptions[type]}): ${score}分`
).join("\n")}

【主要类型】
${primaryTypes.map((t, i) =>
    `${i + 1}. ${t.type} (${typeDescriptions[t.type]})`
).join("\n")}

请给出：
1. 主要职业兴趣特质分析  
2. 适合的专业（推荐5-8个）  
3. 适合的职业方向  
4. 发展建议  
`;

        let deepseekAnalysis;

        try {
            const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.7,
                    max_tokens: 2000
                })
            });

            const data = await res.json();

            deepseekAnalysis = data.choices?.[0]?.message?.content ||
                "DeepSeek 返回内容为空。";

        } catch (err) {
            console.error("DeepSeek 调用失败：", err);
            deepseekAnalysis = generateDefaultHollandAnalysis(scores, primaryTypes, hollandCode);
        }

        // ====== 返回给前端 ======
        return NextResponse.json({
            success: true,
            data: {
                hollandCode,
                scores,
                primaryTypes,
                analysis: deepseekAnalysis,
                analysisTime: new Date().toISOString()
            }
        });

    } catch (err) {
        console.error("霍兰德错误：", err);
        return NextResponse.json(
            { success: false, message: "霍兰德分析失败", error: err.toString() },
            { status: 500 }
        );
    }
}
