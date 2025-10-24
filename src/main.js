/**
 * Функция для расчета выручки с учетом скидки
 * @param purchase запись о покупке
 * @param _product карточка товара (опционально)
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, product) {
  const { sale_price, quantity, discount } = purchase;
  const revenue = sale_price * quantity * (1 - discount / 100);
  return parseFloat(revenue.toFixed(2));
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
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
/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
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
    seller_id: seller.seller_id,
    name: seller.name,
    revenue: 0,
    profit: 0,
    sales_count: 0,
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
    const product = productsMap[purchase.product_sku];
    
    if (seller && product) {
      const sellerResult = seller.result;
      const sellerIndex = seller.index;
      
      // Рассчитываем выручку
      const revenue = calculateRevenue(purchase, product);
      sellerResult.revenue += revenue;
      
      // Рассчитываем прибыль (выручка - себестоимость)
      const cost = product.cost_price * purchase.quantity;
      const profit = revenue - cost;
      sellerResult.profit += profit;
      
      // Увеличиваем счетчик продаж
      sellerResult.sales_count += purchase.quantity;
      
      // Собираем статистику по продуктам
      if (!sellerProducts[sellerIndex]) {
        sellerProducts[sellerIndex] = {};
      }
      
      if (!sellerProducts[sellerIndex][purchase.product_sku]) {
        sellerProducts[sellerIndex][purchase.product_sku] = 0;
      }
      sellerProducts[sellerIndex][purchase.product_sku] += purchase.quantity;
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
        .sort((a, b) => b.quantity - a.quantity || a.sku.localeCompare(b.sku))
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