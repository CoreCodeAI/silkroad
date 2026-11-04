# FastMoss 官方 MCP 工具速查

来源：FastMoss 开发者文档（developers.fastmoss.com）与其官方发布的工具目录。服务地址 `https://mcp.fastmoss.com/mcp`，OAuth 登录。工具在对话里的名字是 `mcp__fastmoss__<工具名>`。

参数大多放在 `filter` 对象里（例如 `filter.region`、`filter.product_id`、`filter.date_type`、`filter.date_value`），列表类工具有 `page`、`pagesize`。**以连接后实际返回的工具 schema 为准**；本表只用来找该用哪个工具。

| 工具 | 分组 | 用途 |
|---|---|---|
| `ad_data_overview` | Ad | Ad video spend/ROAS/plays by video_id and date range |
| `ad_search` | Ad | Search active ad creatives with filters |
| `agency_creator_analysis` | Agency | MCN creator structure and list (needs agency_id) |
| `agency_product_analysis` | Agency | MCN product category and price-band structure |
| `agency_product_list` | Agency | MCN promoted products |
| `agency_profile_overview` | Agency | MCN profile and 7/28/90-day overview |
| `agency_rank_top` | Agency | Weekly/monthly MCN rankings |
| `agency_search` | Agency | Search MCNs |
| `agency_shop_analysis` | Agency | MCN collaborating shops |
| `credit_usage_summary` | Aux | Account MCP credit usage (no args) |
| `fastmoss_detail_url_examples` | Aux | FastMoss detail-page URL templates |
| `search_category_by_words` | Aux | Category name to category_id |
| `search_fastmoss_documents` | Aux | FastMoss rules/features knowledge base |
| `creator_cargo_summary` | Creator | Video vs live selling split, main categories |
| `creator_data_trends` | Creator | Follower/engagement/commerce daily trends |
| `creator_fans_distribution` | Creator | Audience age/gender/location |
| `creator_product_list` | Creator | Creator showcase products |
| `creator_profile_overview` | Creator | Creator profile and performance |
| `creator_rank_top_ecommerce` | Creator | Top ecommerce creators |
| `creator_rank_top_growth` | Creator | Fastest-growing creators |
| `creator_rank_top_potential` | Creator | Creators with ecommerce potential |
| `creator_search` | Creator | Search creators by keyword/niche/region |
| `creator_video_analysis` | Creator | Video tags and selling videos |
| `live_detail_analysis` | Live | One live session: info, performance, categories |
| `live_products_list` | Live | Products sold in a live session |
| `live_search` | Live | Search live sessions |
| `market_category_analysis` | Market | analysis_type: basic_metrics, sales_trends, price_distribution |
| `market_category_author_sales_matrix` | Market | Category sales by creator follower tier |
| `market_category_ranking` | Market | Category ranking, growth, concentration |
| `product_category_info` | Product | Product category tree |
| `product_creator_analysis` | Product | Creators selling a product |
| `product_detail_info` | Product | Product basics, shop, price, rating, images, ad status |
| `product_investment` | Product | Product ad spend, ROAS, daily paid traffic |
| `product_overview` | Product | Channel attribution, lifecycle, ad vs organic |
| `product_rank_new_listed` | Product | New-product ranking |
| `product_rank_top_selling` | Product | Bestseller ranking |
| `product_review_list` | Product | Product reviews |
| `product_sales_trend` | Product | Product GMV/units daily trend |
| `product_search` | Product | Search products |
| `product_sku` | Product | SKU sales and inventory shares |
| `product_video_list` | Product | Videos selling a product |
| `shop_base_info` | Shop | Shop snapshot (needs seller_id) |
| `shop_creator_analysis` | Shop | Shop collaborators and tiers |
| `shop_data_trends` | Shop | Shop daily GMV/units/creator/live trends |
| `shop_investment_analysis` | Shop | Shop ad spend and ROAS |
| `shop_live_analysis` | Shop | Shop live performance |
| `shop_product_analysis` | Shop | Shop categories, price bands, product list |
| `shop_rank_top_selling` | Shop | Top shops by market/category |
| `shop_sale_analysis` | Shop | Shop sales by channel (video, live, card, creator) |
| `shop_search` | Shop | Search shops |
| `shop_video_analysis` | Shop | Shop selling videos and ad status |
| `video_data_trends` | Video | One video's daily play/like/comment/share trend |
| `video_detail_analysis` | Video | One video's basics, metrics, linked products |
| `video_script_info` | Video | Subtitles/spoken text (needs video_id) |
| `video_search` | Video | Search videos |
