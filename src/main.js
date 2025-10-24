/**
 * Функция для расчета выручки с учетом скидки
 * @param purchase запись о покупке
 * @param _product карточка товара (опционально)
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    const { discount = 0, sale_price, quantity } = purchase;
    
    // Записываем в константу discount остаток суммы без скидки в десятичном формате
    const discountMultiplier = 1 - (discount / 100);
    
    // Возвращаем выручку: sale_price × количество проданных товаров quantity × константа discount
    const revenue = sale_price * quantity * discountMultiplier;
    
    return Math.round(revenue * 100) / 100;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    // 15% — для продавца, который принёс наибольшую прибыль (первое место)
    if (index === 0) {
        return 0.15;
    } 
    // 10% — для продавцов, которые оказались на втором и третьем месте по прибыли
    else if (index === 1 || index === 2) {
        return 0.10;
    } 
    // 0% — для продавца, который оказался на последнем месте
    else if (index === total - 1) {
        return 0;
    } 
    // 5% — для всех остальных продавцов
    else {
        return 0.05;
    }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // Проверка входных данных
    if (!data
        || !Array.isArray(data.purchase_records)
        || !Array.isArray(data.products)
        || !Array.isArray(data.sellers)
        || data.purchase_records.length === 0
        || data.products.length === 0
        || data.sellers.length === 0
    ) {
        throw new Error('Некорректные входные данные: ожидается объект с непустыми массивами purchase_records, products, sellers');
    }

    // Проверка наличия опций
    if (!options) {
        throw new Error('Не указаны опции расчета');
    }

    const { calculateRevenue, calculateBonus } = options;
    
    if (!calculateRevenue || !calculateBonus) {
        throw new Error('В опциях отсутствуют необходимые функции calculateRevenue и calculateBonus');
    }

    if (typeof calculateRevenue !== 'function' || typeof calculateBonus !== 'function') {
        throw new Error('calculateRevenue и calculateBonus должны быть функциями');
    }

    // Подготовка промежуточных данных для сбора статистики
    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {}
    }));

    // Преобразование продавцов и товаров в объекты для быстрого доступа
    const sellerIndex = Object.fromEntries(
        sellerStats.map(seller => [seller.id, seller])
    );

    const productIndex = Object.fromEntries(
        data.products.map(product => [product.sku, product])
    );

    // Двойной цикл перебора чеков и покупок в них
    let validPurchasesCount = 0;
    let skippedPurchases = 0;
    
    data.purchase_records.forEach(record => {
        // Чек
        const seller = sellerIndex[record.seller_id]; // Продавец
        
        if (!seller) {
            console.warn(`Пропущен чек с несуществующим seller_id: ${record.seller_id}`);
            skippedPurchases++;
            return;
        }
        
        // Увеличить количество продаж
        seller.sales_count += 1;
        
        // Увеличить общую сумму всех продаж (используем total_amount из чека)
        seller.revenue += record.total_amount;

        // Расчёт прибыли для каждого товара
        record.items.forEach(item => {
            const product = productIndex[item.sku]; // Товар
            
            if (!product) {
                console.warn(`Пропущен товар с несуществующим sku: ${item.sku} в чеке ${record.receipt_id}`);
                return;
            }
            
            try {
                // Посчитать себестоимость (cost) товара как product.purchase_price, умноженную на количество товаров из чека
                const cost = product.purchase_price * item.quantity;
                
                // Посчитать выручку (revenue) с учётом скидки через функцию calculateRevenue
                const itemRevenue = calculateRevenue(item, product);
                
                // Посчитать прибыль: выручка минус себестоимость
                const itemProfit = itemRevenue - cost;
                
                // Увеличить общую накопленную прибыль (profit) у продавца
                seller.profit += itemProfit;

                // Учёт количества проданных товаров
                if (!seller.products_sold[item.sku]) {
                    seller.products_sold[item.sku] = 0;
                }
                // По артикулу товара увеличить его проданное количество у продавца
                seller.products_sold[item.sku] += item.quantity;
                
                validPurchasesCount++;
                
            } catch (error) {
                console.error(`Ошибка при расчете товара в чеке ${record.receipt_id}:`, error.message, item);
            }
        });
    });

    // Логирование процесса обработки
    console.log(`Обработано валидных товаров: ${validPurchasesCount}`);
    console.log(`Пропущено чеков: ${skippedPurchases}`);
    console.log(`Всего записей о покупках: ${data.purchase_records.length}`);

    // Проверка, что есть валидные покупки для анализа
    if (validPurchasesCount === 0) {
        throw new Error('Нет валидных данных о покупках для анализа');
    }

    // Преобразование статистики в массив и фильтрация продавцов с продажами
    let sellersArray = sellerStats.filter(seller => seller.sales_count > 0);

    // Проверка, что остались продавцы с продажами
    if (sellersArray.length === 0) {
        throw new Error('Нет данных о продажах для анализа');
    }

    // Шаг 2: Сортируем продавцов по прибыли (по убыванию)
    sellersArray.sort((a, b) => b.profit - a.profit);

    // Шаг 3: Назначаем премии на основе ранжирования и формируем топ-10 продуктов
    const totalSellers = sellersArray.length;
    
    sellersArray.forEach((seller, index) => {
        try {
            // Посчитайте бонус, используя функцию calculateBonus
            seller.bonus = calculateBonus(index, totalSellers, seller);
            
            // Сформируйте топ-10 проданных продуктов
            seller.top_products = Object.entries(seller.products_sold)
                .map(([sku, quantity]) => ({ sku, quantity }))
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 10)
                .map(item => item.sku);
                
        } catch (error) {
            console.error('Ошибка при расчете бонуса для продавца:', seller.id, error);
            seller.bonus = 0;
            seller.top_products = [];
        }
    });

    // Подготовка итоговой коллекции с нужными полями
    return sellersArray.map(seller => ({
        seller_id: seller.id,
        name: seller.name,
        revenue: Math.round(seller.revenue * 100) / 100,
        profit: Math.round(seller.profit * 100) / 100,
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: seller.bonus
    }));
}

