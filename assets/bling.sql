CREATE TABLE IF NOT EXISTS `ecomplus_orders` (
  `id` int(11) NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `order_store` int(10) NOT NULL,
  `order_ecom_id` varchar(24) DEFAULT NULL,
  `order_loja_id` int(10) NOT NULL,
  `order_ecom_status` varchar(255) DEFAULT NULL,
  `order_bling_status` varchar(255) DEFAULT NULL,
  `order_bling_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ecomplus_products` (
  `id` int(11) NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `product_sku` varchar(100) NOT NULL,
  `product_name` varchar(255) NOT NULL,
  `product_ecom_price` decimal(10,0) NOT NULL,
  `product_ecom_stock` int(11) NOT NULL,
  `product_bling_price` decimal(10,0) NOT NULL,
  `product_bling_stock` int(11) DEFAULT NULL,
  `product_store_id` int(11) NOT NULL,
  `product_loja_id` int(10) NOT NULL,
  `product_id` varchar(24) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `transaction_history` (
  `id` int(11) NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `type` enum('order','product','stock') NOT NULL,
  `stock` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `ecomplus_orders`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `ecomplus_products`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `transaction_history`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `ecomplus_orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=82;

ALTER TABLE `ecomplus_products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14777;

ALTER TABLE `transaction_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
