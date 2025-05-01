// 全局变量存储所有实体数据
let allEntityStats = [];
let selectedDateString = '';
let globalStats = null;

// Chart.js 实例
let durationPieChart = null;
let messagesBarChart = null;
let tokensBarChart = null;
let aiResponseTimeChart = null;
let entityMessagesPieChart = null;
let entityTokensPieChart = null;
let entityEfficiencyChart = null;

// 格式化时间函数
function formatDuration(ms) {
    if (typeof ms !== 'number' || ms <= 0) return '0s';
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    seconds %= 60; minutes %= 60;
    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m `;
    if (seconds >= 0) result += `${seconds}s`;
    return result.trim() || '0s';
}

// 打开主日报模态框
function openMainReportModal() {
    // 获取当前选择的日期
    const dateSelector = document.getElementById('day1-date-selector');
    if (dateSelector) {
        selectedDateString = dateSelector.value;
    } else {
        selectedDateString = new Date().toISOString().split('T')[0];
    }
    
    // 打开模态框
    document.getElementById('main-report-modal').classList.add('active');
    document.getElementById('report-date').textContent = `${selectedDateString}`;
    
    // 获取统计数据并渲染
    loadAndRenderReportData();
}

// 关闭主日报模态框
function closeMainModal() {
    document.getElementById('main-report-modal').classList.remove('active');
}

// 打开角色日报模态框
function openEntityReportModal(entityId) {
    // 查找对应实体数据
    const entityData = allEntityStats.find(entity => entity.entityId === entityId);
    if (!entityData) return;
    
    // 打开模态框
    document.getElementById('entity-report-modal').classList.add('active');
    document.getElementById('entity-report-title').textContent = entityData.entityName || entityId;
    document.getElementById('entity-report-date').textContent = selectedDateString;
    
    // 渲染角色日报
    renderEntityReport(entityData);
}

// 关闭角色日报模态框
function closeEntityModal() {
    document.getElementById('entity-report-modal').classList.remove('active');
}

// 加载并渲染报表数据
async function loadAndRenderReportData() {
    try {
        // 获取所有统计数据 (使用 IndexedDB)
        allEntityStats = await getAllStats();
        
        // 找到全局统计
        globalStats = allEntityStats.find(stat => stat.entityId === '_GLOBAL_STATS_');
        
        // 过滤掉全局统计，只保留角色/群组的统计
        const entityStats = allEntityStats.filter(stat => stat.entityId !== '_GLOBAL_STATS_');
        
        // 渲染主日报
        renderMainReport(entityStats, globalStats);
        
        // 添加动画
        animateCards();
    } catch (error) {
        console.error('加载报表数据失败:', error);
    }
}

// 打开 IndexedDB 并获取所有数据
function getAllStats() {
    return new Promise((resolve, reject) => {
        // 打开数据库
        const request = indexedDB.open('SillyTavernDay1Stats', 1);
        
        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction('dailyStats', 'readonly');
            const store = transaction.objectStore('dailyStats');
            const getRequest = store.getAll();
            
            getRequest.onsuccess = (event) => {
                resolve(event.target.result || []);
            };
            
            getRequest.onerror = (event) => {
                reject('读取数据失败: ' + event.target.error);
            };
        };
        
        request.onerror = (event) => {
            reject('打开数据库失败: ' + event.target.error);
        };
    });
}

// 渲染主日报
function renderMainReport(entityStats, globalStats) {
    // 提取当日数据
    const entitiesWithData = entityStats.filter(entity => 
        entity.dailyData && entity.dailyData[selectedDateString]);
    
    // 计算汇总指标
    const totalOnlineDuration = globalStats?.dailyData?.[selectedDateString]?.totalVisibleDurationMs || 0;
    let totalMessages = 0;
    let totalTokens = 0;
    
    entitiesWithData.forEach(entity => {
        const dailyData = entity.dailyData[selectedDateString];
        totalMessages += (dailyData.userMessages || 0) + (dailyData.aiMessages || 0);
        totalTokens += (dailyData.userTokens || 0) + (dailyData.aiTokens || 0) + (dailyData.cumulativeTokens || 0);
    });
    
    // 更新关键指标显示
    document.getElementById('total-online-duration').textContent = formatDuration(totalOnlineDuration);
    document.getElementById('total-entities').textContent = entitiesWithData.length;
    document.getElementById('total-messages').textContent = totalMessages;
    document.getElementById('total-tokens').textContent = totalTokens;
    
    // 渲染图表
    renderDurationPieChart(entitiesWithData);
    renderMessagesBarChart(entitiesWithData);
    renderTokensBarChart(entitiesWithData);
    renderAiResponseTimeChart(entitiesWithData);
    
    // 渲染角色列表
    renderEntityList(entitiesWithData);
}

// 渲染角色互动时间占比图表
function renderDurationPieChart(entities) {
    const ctx = document.getElementById('duration-pie-chart').getContext('2d');
    
    // 提取数据
    const labels = entities.map(entity => entity.entityName || entity.entityId);
    const data = entities.map(entity => entity.dailyData[selectedDateString].dailyInteractionDurationMs || 0);
    
    // 生成颜色
    const colors = generateColors(entities.length);
    
    if (durationPieChart) {
        durationPieChart.destroy();
    }
    
    durationPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: '#222222',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${formatDuration(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// 渲染消息数对比图表
function renderMessagesBarChart(entities) {
    const ctx = document.getElementById('messages-bar-chart').getContext('2d');
    
    // 只取前8个实体，避免图表过度拥挤
    const topEntities = [...entities]
        .sort((a, b) => {
            const totalA = (a.dailyData[selectedDateString].userMessages || 0) + 
                          (a.dailyData[selectedDateString].aiMessages || 0);
            const totalB = (b.dailyData[selectedDateString].userMessages || 0) + 
                          (b.dailyData[selectedDateString].aiMessages || 0);
            return totalB - totalA;
        })
        .slice(0, 8);
    
    // 提取数据
    const labels = topEntities.map(entity => entity.entityName || entity.entityId);
    const userMessages = topEntities.map(entity => entity.dailyData[selectedDateString].userMessages || 0);
    const aiMessages = topEntities.map(entity => entity.dailyData[selectedDateString].aiMessages || 0);
    
    if (messagesBarChart) {
        messagesBarChart.destroy();
    }
    
    messagesBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '用户消息',
                    data: userMessages,
                    backgroundColor: 'rgba(0, 174, 239, 0.7)',
                    borderColor: 'rgba(0, 174, 239, 1)',
                    borderWidth: 1
                },
                {
                    label: 'AI消息',
                    data: aiMessages,
                    backgroundColor: 'rgba(255, 165, 0, 0.7)',
                    borderColor: 'rgba(255, 165, 0, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#ffffff'
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: '#333333'
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: '#333333'
                    }
                }
            }
        }
    });
}

// 渲染Token消耗对比图表
function renderTokensBarChart(entities) {
    // 实现省略，与messagesBarChart类似...
    const ctx = document.getElementById('tokens-bar-chart').getContext('2d');
    
    // 只取前8个实体，避免图表过度拥挤
    const topEntities = [...entities]
        .sort((a, b) => {
            const totalA = (a.dailyData[selectedDateString].userTokens || 0) + 
                          (a.dailyData[selectedDateString].aiTokens || 0) +
                          (a.dailyData[selectedDateString].cumulativeTokens || 0);
            const totalB = (b.dailyData[selectedDateString].userTokens || 0) + 
                          (b.dailyData[selectedDateString].aiTokens || 0) +
                          (b.dailyData[selectedDateString].cumulativeTokens || 0);
            return totalB - totalA;
        })
        .slice(0, 8);
    
    // 提取数据
    const labels = topEntities.map(entity => entity.entityName || entity.entityId);
    const userTokens = topEntities.map(entity => entity.dailyData[selectedDateString].userTokens || 0);
    const aiTokens = topEntities.map(entity => entity.dailyData[selectedDateString].aiTokens || 0);
    const promptTokens = topEntities.map(entity => entity.dailyData[selectedDateString].cumulativeTokens || 0);
    
    if (tokensBarChart) {
        tokensBarChart.destroy();
    }
    
    tokensBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '用户Tokens',
                    data: userTokens,
                    backgroundColor: 'rgba(0, 174, 239, 0.7)',
                    borderColor: 'rgba(0, 174, 239, 1)',
                    borderWidth: 1
                },
                {
                    label: 'AI Tokens',
                    data: aiTokens,
                    backgroundColor: 'rgba(255, 165, 0, 0.7)',
                    borderColor: 'rgba(255, 165, 0, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Prompt Tokens',
                    data: promptTokens,
                    backgroundColor: 'rgba(75, 192, 192, 0.7)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#ffffff'
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: '#333333'
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: '#333333'
                    }
                }
            }
        }
    });
}

// 渲染AI响应时间对比图表
function renderAiResponseTimeChart(entities) {
    // 实现省略...
    const ctx = document.getElementById('ai-response-time-chart').getContext('2d');
    
    // 按AI响应时间排序
    const sortedEntities = [...entities]
        .filter(entity => entity.dailyData[selectedDateString].totalAiResponseDuration > 0)
        .sort((a, b) => b.dailyData[selectedDateString].totalAiResponseDuration - 
                         a.dailyData[selectedDateString].totalAiResponseDuration)
        .slice(0, 10); // 只取前10个
    
    // 提取数据
    const labels = sortedEntities.map(entity => entity.entityName || entity.entityId);
    const data = sortedEntities.map(entity => entity.dailyData[selectedDateString].totalAiResponseDuration || 0);
    
    if (aiResponseTimeChart) {
        aiResponseTimeChart.destroy();
    }
    
    aiResponseTimeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'AI响应时间 (ms)',
                data: data,
                backgroundColor: 'rgba(153, 102, 255, 0.7)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `AI响应时间: ${formatDuration(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        color: '#ffffff',
                        callback: function(value) {
                            return formatDuration(value);
                        }
                    },
                    grid: {
                        color: '#333333'
                    }
                },
                y: {
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: '#333333'
                    }
                }
            }
        }
    });
}

// 渲染角色列表
function renderEntityList(entities) {
    const tableBody = document.getElementById('entity-list-body');
    tableBody.innerHTML = '';
    
    // 按交互时长排序
    const sortedEntities = [...entities].sort((a, b) => {
        return (b.dailyData[selectedDateString].dailyInteractionDurationMs || 0) - 
               (a.dailyData[selectedDateString].dailyInteractionDurationMs || 0);
    });
    
    sortedEntities.forEach((entity, index) => {
        const dailyData = entity.dailyData[selectedDateString];
        const tr = document.createElement('tr');
        
        // 根据索引添加延迟动画
        tr.style.opacity = '0';
        tr.style.transform = 'translateY(20px)';
        tr.style.transition = `opacity 0.5s ease, transform 0.5s ease`;
        tr.style.transitionDelay = `${index * 0.05}s`;
        
        setTimeout(() => {
            tr.style.opacity = '1';
            tr.style.transform = 'translateY(0)';
        }, 10);
        
        const totalMessages = (dailyData.userMessages || 0) + (dailyData.aiMessages || 0);
        
        tr.innerHTML = `
            <td class="py-2">${entity.entityName || entity.entityId}</td>
            <td class="py-2">${totalMessages}</td>
            <td class="py-2">${formatDuration(dailyData.dailyInteractionDurationMs || 0)}</td>
            <td class="py-2">
                <button class="bg-highlight hover:bg-blue-600 text-white px-3 py-1 rounded-md"
                        onclick="openEntityReportModal('${entity.entityId}')">
                    角色日报
                </button>
            </td>
        `;
        
        if (index % 2 !== 0) {
            tr.style.backgroundColor = '#1a1a1a';
        }
        
        tableBody.appendChild(tr);
    });
}

// 渲染角色日报
function renderEntityReport(entityData) {
    const dailyData = entityData.dailyData[selectedDateString];
    if (!dailyData) return;
    
    // 更新关键指标
    document.getElementById('entity-interaction-duration').textContent = formatDuration(dailyData.dailyInteractionDurationMs || 0);
    document.getElementById('entity-total-messages').textContent = (dailyData.userMessages || 0) + (dailyData.aiMessages || 0);
    document.getElementById('entity-total-tokens').textContent = (dailyData.userTokens || 0) + (dailyData.aiTokens || 0) + (dailyData.cumulativeTokens || 0);
    document.getElementById('entity-ai-response-time').textContent = formatDuration(dailyData.totalAiResponseDuration || 0);
    
    // 渲染消息比例图表
    renderEntityMessagesPieChart(dailyData);
    
    // 渲染Token分布图表
    renderEntityTokensPieChart(dailyData);
    
    // 渲染效率分析图表
    renderEntityEfficiencyChart(dailyData);
}

// 渲染角色消息比例图表
function renderEntityMessagesPieChart(dailyData) {
    // 实现省略...
    const ctx = document.getElementById('entity-messages-pie-chart').getContext('2d');
    
    const userMessages = dailyData.userMessages || 0;
    const aiMessages = dailyData.aiMessages || 0;
    
    if (entityMessagesPieChart) {
        entityMessagesPieChart.destroy();
    }
    
    entityMessagesPieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['用户消息', 'AI消息'],
            datasets: [{
                data: [userMessages, aiMessages],
                backgroundColor: [
                    'rgba(0, 174, 239, 0.7)',
                    'rgba(255, 165, 0, 0.7)'
                ],
                borderColor: [
                    'rgba(0, 174, 239, 1)',
                    'rgba(255, 165, 0, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// 渲染角色Token分布图表
function renderEntityTokensPieChart(dailyData) {
    // 实现省略...
    // 与renderEntityMessagesPieChart类似
}

// 渲染效率分析图表
function renderEntityEfficiencyChart(dailyData) {
    // 实现省略...
    // 复杂的散点图实现
}


// 辅助函数：生成柔和的颜色列表
function generateColors(count) {
    const colors = [];
    const baseColors = [
        [0, 174, 239],   // 蓝色
        [255, 165, 0],   // 橙色
        [75, 192, 192],  // 青色
        [153, 102, 255], // 紫色
        [255, 99, 132],  // 粉色
        [54, 162, 235],  // 淡蓝
        [255, 206, 86],  // 黄色
        [231, 233, 237], // 灰色
        [46, 204, 113],  // 绿色
        [156, 39, 176]   // 深紫色
    ];
    
    for (let i = 0; i < count; i++) {
        const colorIndex = i % baseColors.length;
        const [r, g, b] = baseColors[colorIndex];
        
        // 略微调整颜色，使其产生变化
        const variation = 30 * Math.floor(i / baseColors.length);
        const newR = Math.max(0, Math.min(255, r - variation));
        const newG = Math.max(0, Math.min(255, g - variation));
        const newB = Math.max(0, Math.min(255, b - variation));
        
        colors.push(`rgba(${newR}, ${newG}, ${newB}, 0.7)`);
    }
    
    return colors;
}

// 卡片动画
function animateCards() {
    const cards = document.querySelectorAll('.card');
    
    cards.forEach((card, index) => {
        setTimeout(() => {
            card.classList.add('visible');
        }, index * 100);
    });
}

// 使用 Intersection Observer 监听卡片进入视口
function setupIntersectionObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    
    document.querySelectorAll('.card').forEach(card => {
        observer.observe(card);
    });
}

// 注入日报按钮到原始界面
function injectReportButton() {
    // 找到日期选择器旁边的按钮组
    const dateButtonsContainer = document.querySelector('#day1-goto-today-button')?.parentElement;
    
    if (dateButtonsContainer) {
        // 创建日报按钮
        const reportButton = document.createElement('button');
        reportButton.id = 'day1-report-button';
        reportButton.className = 'menu_button';
        reportButton.title = '查看日报';
        reportButton.innerHTML = '<i class="fa-solid fa-chart-pie"></i> 日报';
        reportButton.onclick = openMainReportModal;
        
        // 添加按钮到日期选择器旁边
        dateButtonsContainer.appendChild(reportButton);
        console.log('日报按钮已注入');
    } else {
        console.error('未找到日期按钮容器，无法注入日报按钮');
        
        // 尝试在刷新按钮后添加
        const refreshButton = document.querySelector('#day1-refresh-button');
        if (refreshButton) {
            const reportButton = document.createElement('button');
            reportButton.id = 'day1-report-button';
            reportButton.className = 'menu_button';
            reportButton.title = '查看日报';
            reportButton.innerHTML = '<i class="fa-solid fa-chart-pie"></i> 日报';
            reportButton.onclick = openMainReportModal;
            
            refreshButton.parentNode.insertBefore(reportButton, refreshButton.nextSibling);
            console.log('日报按钮已添加到刷新按钮后');
        }
    }
}

// 初始化函数
function initDailyReport() {
    // 注入日报按钮
    injectReportButton();
    
    // 设置卡片动画观察器
    setupIntersectionObserver();
    
    console.log('日报功能初始化完成');
}

// 当DOM加载完成后执行初始化
document.addEventListener('DOMContentLoaded', initDailyReport);
