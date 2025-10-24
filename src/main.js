// Функция расчета выручки для одного товара в чеке
function calculateSimpleRevenue(purchaseItem, product) {
    if (!purchaseItem || !product) {
        throw new Error('Необходимо передать purchaseItem и product');
    }
    
    const { sale_price, quantity, discount = 0 } = purchaseItem;
    const revenue = sale_price * quantity * (1 - discount / 100);
    return parseFloat(revenue.toFixed(2));
}

// Функция расчета бонусов на основе позиции в рейтинге
function calculateBonusByProfit(sellerIndex, totalSellers, sellerData) {
    if (sellerIndex >= totalSellers - 1) {
        return 0; // Последний продавец не получает бонус
    }
    
    const profit = sellerData.profit;
    let bonusRate;
    
    if (sellerIndex === 0) {
        bonusRate = 0.15; // Первый продавец - 15%
    } else if (sellerIndex === 1 || sellerIndex === 2) {
        bonusRate = 0.10; // Второй и третий - 10%
    } else {
        bonusRate = 0.05; // Остальные (кроме последнего) - 5%
    }
    
    const bonus = profit * bonusRate;
    return parseFloat(bonus.toFixed(2));
}

// Основная функция анализа данных продаж
function analyzeSalesData(data, options = {}) {
    const { calculateRevenue, calculateBonus } = options;
    
    // Проверка обязательных параметров
    if (!calculateRevenue || !calculateBonus) {
        throw new Error('Необходимо передать calculateRevenue и calculateBonus');
    }
    
    // Проверка наличия данных
    if (!data || !data.sellers || !data.products || !data.purchase_records) {
        throw new Error('Отсутствуют необходимые данные');
    }
    
    // Проверка пустых массивов
    if (data.sellers.length === 0 || data.products.length === 0 || data.purchase_records.length === 0) {
        throw new Error('Массивы данных не могут быть пустыми');
    }
    
    const { sellers, products, purchase_records } = data;
    
    // Создаем карту продуктов для быстрого доступа
    const productsMap = {};
    products.forEach(product => {
        productsMap[product.sku] = product;
    });
    
    // Инициализируем результаты для каждого продавца
    const sellersResults = sellers.map(seller => ({
        seller_id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0, // Количество чеков
        top_products: [],
        bonus: 0
    }));
    
    // Создаем карту для быстрого доступа к результатам продавцов
    const sellersMap = {};
    sellersResults.forEach((seller, index) => {
        sellersMap[seller.seller_id] = { result: seller, index };
    });
    
    // Собираем статистику по продуктам для каждого продавца
    const sellerProducts = {};
    
    // Обрабатываем каждую запись о покупке
    purchase_records.forEach(purchase => {
        const seller = sellersMap[purchase.seller_id];
        
        if (seller) {
            const sellerResult = seller.result;
            const sellerIndex = seller.index;
            
            // Увеличиваем счетчик продаж (количество чеков)
            sellerResult.sales_count += 1;
            
            // Обрабатываем каждый товар в чеке
            purchase.items.forEach(item => {
                const product = productsMap[item.sku];
                
                if (product) {
                    // Рассчитываем выручку
                    const revenue = calculateRevenue(item, product);
                    sellerResult.revenue += revenue;
                    
                    // Рассчитываем прибыль (выручка - себестоимость)
                    const cost = product.purchase_price * item.quantity;
                    const profit = revenue - cost;
                    sellerResult.profit += profit;
                    
                    // Собираем статистику по продуктам
                    if (!sellerProducts[sellerIndex]) {
                        sellerProducts[sellerIndex] = {};
                    }
                    
                    if (!sellerProducts[sellerIndex][item.sku]) {
                        sellerProducts[sellerIndex][item.sku] = 0;
                    }
                    sellerProducts[sellerIndex][item.sku] += item.quantity;
                }
            });
        }
    });
    
    // Форматируем числовые значения и определяем топ-продукты
    sellersResults.forEach((seller, index) => {
        seller.revenue = parseFloat(seller.revenue.toFixed(2));
        seller.profit = parseFloat(seller.profit.toFixed(2));
        
        // Формируем топ-продукты
        if (sellerProducts[index]) {
            const productsArray = Object.entries(sellerProducts[index])
                .map(([sku, quantity]) => ({ sku, quantity }))
                .sort((a, b) => {
                    // Сначала сортируем по количеству (по убыванию)
                    if (b.quantity !== a.quantity) {
                        return b.quantity - a.quantity;
                    }
                    // Если количество одинаковое, сортируем по SKU по УБЫВАНИЮ (от большего к меньшему)
                    const getNumber = (sku) => parseInt(sku.replace('SKU_', ''), 10);
                    return getNumber(b.sku) - getNumber(a.sku);
                })
                .slice(0, 10);
            
            seller.top_products = productsArray;
        }
    });
    
    // Сортируем продавцов по прибыли (по убыванию)
    sellersResults.sort((a, b) => b.profit - a.profit);
    
    // Рассчитываем бонусы
    sellersResults.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, sellersResults.length, seller);
    });
    
    return sellersResults;
}

// Экспорт для тестов
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateSimpleRevenue,
        calculateBonusByProfit,
        analyzeSalesData
    };
}