-- phpMyAdmin SQL Dump
-- version 4.6.6deb5
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: 10-Maio-2019 às 11:45
-- Versão do servidor: 10.1.38-MariaDB-0ubuntu0.18.04.1
-- PHP Version: 7.2.17-0ubuntu0.18.04.1

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `bling_manager`
--

-- --------------------------------------------------------

--
-- Estrutura da tabela `ecomplus_orders`
--

CREATE TABLE `ecomplus_orders` (
  `id` int(11) NOT NULL,
  `created_at` datetime,
  `updated_at` datetime DEFAULT NULL,
  `order_store` int(10) NOT NULL,
  `order_ecom_id` varchar(24) DEFAULT NULL,
  `order_loja_id` int(10) NOT NULL,
  `order_ecom_status` varchar(255) DEFAULT NULL,
  `order_bling_status` varchar(255) DEFAULT NULL,
  `order_bling_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estrutura da tabela `ecomplus_products`
--

CREATE TABLE `ecomplus_products` (
  `id` int(11) NOT NULL,
  `created_at` datetime,
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

-- --------------------------------------------------------

--
-- Estrutura da tabela `ecomplus_products_variations`
--

CREATE TABLE `ecomplus_products_variations` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `variation_id` varchar(24) NOT NULL,
  `variation_sku` varchar(200) NOT NULL,
  `variation_stock_ecomplus` int(11) DEFAULT NULL,
  `variation_stock_bling` int(11) DEFAULT NULL,
  `lojaId` int(11) DEFAULT NULL,
  `store_id` int(11) DEFAULT NULL,
  `parent_sku` varchar(200) NOT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estrutura da tabela `transaction_history`
--

CREATE TABLE `transaction_history` (
  `id` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  `type` enum('order','product','stock') NOT NULL,
  `stock` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `ecomplus_orders`
--
ALTER TABLE `ecomplus_orders`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `ecomplus_products`
--
ALTER TABLE `ecomplus_products`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `ecomplus_products_variations`
--
ALTER TABLE `ecomplus_products_variations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `transaction_history`
--
ALTER TABLE `transaction_history`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `ecomplus_orders`
--
ALTER TABLE `ecomplus_orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2697;
--
-- AUTO_INCREMENT for table `ecomplus_products`
--
ALTER TABLE `ecomplus_products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17858;
--
-- AUTO_INCREMENT for table `ecomplus_products_variations`
--
ALTER TABLE `ecomplus_products_variations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5243;
--
-- AUTO_INCREMENT for table `transaction_history`
--
ALTER TABLE `transaction_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
