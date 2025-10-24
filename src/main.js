/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
// Функция расчета выручки для одного товара в чеке

function calculateSimpleRevenue(purchase, _product) {
  // Расчет выручки от операции
  const { discount, sale_price, quantity } = purchase;
  const decimalDiscount = discount / 100;
  const fullPrice = sale_price * quantity;
  const revenue = fullPrice * (1 - decimalDiscount);
  return revenue;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
// Функция расчета бонусов на основе позиции в рейтинге
function calculateBonusByProfit(index, total, seller) {
  // Расчет бонуса от позиции в рейтинге
  const { profit } = seller;
  if (index === 0) return Math.round(profit * 0.15 * 100) / 100;
  if (index === 1 || index === 2) return Math.round(profit * 0.10 * 100) / 100;
  if (index !== total - 1) return Math.round(profit * 0.05 * 100) / 100;
  return 0;
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */

// Функция для естественной сортировки SKU
function naturalSKUCompare(a, b) {
    // Извлекаем числовую часть из SKU
    const getNumber = (sku) => parseInt(sku.replace('SKU_', ''), 10);
    return getNumber(a) - getNumber(b);
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
// Основная функция анализа данных продаж
function analyzeSalesData(data, options) {
  //  Проверка входных данных

  if (!data) {
    throw new Error("Данные обязательны для обработки");
  }

  if (
    !data.customers ||
    !data.products ||
    !data.sellers ||
    !data.purchase_records
  ) {
    throw new Error("Неверная структура данных");
  }

  if (
    data.customers.length === 0 ||
    data.products.length === 0 ||
    data.sellers.length === 0 ||
    data.purchase_records.length === 0
  ) {
    throw new Error("Все массивы данных должны содержать хотя бы один элемент");
  }

  // Проверка наличия опций

  if (!options) {
    throw new Error("Настройки обработки обязательны");
  }

  const { calculateRevenue, calculateBonus } = options;

  if (typeof options.calculateRevenue !== "function") {
    throw new Error("Функция calculateRevenue обязательна в настройках");
  }

  if (typeof options.calculateBonus !== "function") {
    throw new Error("Функция calculateBonus обязательна в настройках");
  }

  // Подготовка промежуточных данных для сбора статистики

  const sellersStats = data.sellers.map((seller) => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {},
  }));

  // Индексация продавцов и товаров для быстрого доступа

  const sellerIndex = sellersStats.reduce(
    (result, seller) => ({
      ...result,
      [seller.id]: seller,
    }),
    {}
  );

  const productIndex = data.products.reduce(
    (result, product) => ({
      ...result,
      [product.sku]: product,
    }),
    {}
  );

  // Расчет выручки и прибыли для каждого продавца

  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[record.seller_id];
    if (seller) {
      seller.sales_count += 1;
      seller.revenue += record.total_amount;

      record.items.forEach((item) => {
        const product = productIndex[item.sku];
        if (product) {
          const cost = product.purchase_price * item.quantity
          const revenue = calculateRevenue(item, product)
          const profit = revenue - cost
          seller.profit = seller.profit + profit

          if (!seller.products_sold[item.sku]) {
            seller.products_sold[item.sku] = 0;
          }
          seller.products_sold[item.sku] += item.quantity;
        }
      });
    }
  });

  // Сортировка продавцов по прибыли

  sellersStats.sort((a, b) => b.profit - a.profit);

  // Назначение премий на основе ранжирования

  sellersStats.forEach((seller, index) => {
    seller.bonus = calculateBonus(index, sellersStats.length, seller);
    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({
        sku,
        quantity,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });

  // Подготовка итоговой коллекции с нужными полями

  return sellersStats.map((seller) => ({
    seller_id: seller.id,
    name: seller.name,
    revenue: Number(seller.revenue.toFixed(2)),
    profit: Number(seller.profit.toFixed(2)),
    sales_count: seller.sales_count,
    top_products: seller.top_products.map((product) => ({
      sku: product.sku,
      quantity: product.quantity,
    })),
    bonus: Math.floor(seller.bonus * 100) / 100,
  }));
}