
Below is a practical plan you can execute to both prepare the data for a Tableau network graph and showcase predictive modeling within the same artifact. It’s organized by phases: data model, transforms/feature engineering, graph metrics, forecasting options, Tableau build, and storytelling.

1) Define the analytic grain and network semantics
- Network definition:
  - Nodes: providers (PCPs and specialists). Color by specialty; size by activity/centrality.
  - Directed edges: from_provider → to_provider where an authorization was requested from one provider to another (e.g., PCP → requested provider). You can also build variants, such as servicing provider or requested specialty (provider → specialty).
- Time grain: monthly is best for volume prediction and stable visualization.
- Status handling: include status in measures so you can filter or color by Approved/Denied/Cancelled.

2) Canonical data model for prep
Create a simple star-like schema to stabilize joins and build consistent aggregates:
- dim_provider
  - provider_id (internal key), NPI (if available), provider_name (cleaned), primary_specialty (standardized), group/organization, location (lat/long if available), taxonomy code.
- bridge_provider_alias
  - raw_provider_id or name variants → provider_id for deduplication.
- dim_date
  - day, month (YYYY-MM), quarter, year, fiscal variants.
- dim_procedure
  - code, mapped category (e.g., CPT/HCPCS major group).
- dim_diagnosis
  - code, mapped category (e.g., CCS/clinical group).
- fact_authorization (raw level)
  - auth_no, request_date, decision_date, decision_status, from_provider_raw, to_provider_raw, to_provider_specialty, procedure_code, diagnosis_code, member_id_hashed.
- fact_edge_month (aggregated)
  - month, from_provider_id, to_provider_id, counts: total_auths, approved, denied, cancelled, modified; unique_members; avg_decision_days; distribution/tag of top procedures; requested_specialty_mix.

3) Data cleaning and entity resolution
- Provider deduplication: normalize names, NPIs, addresses; create a survivorship rule and alias map (bridge_provider_alias) → enforce a single provider_id for each real-world provider.
- Specialty standardization: map to a canonical taxonomy list; fallback to the most frequent specialty per provider when ambiguous.
- Date normalization: ensure request_date exists for time bucketing; derive month = first day of month.
- Code grouping:
  - Procedure codes → group to higher-level categories (CPT sections), store both raw and category.
  - Diagnosis codes → group to CCS or a custom category. This reduces dimensionality and aids modeling.
- Privacy: keep only hashed member_id, drop all PHI/PPI; ensure minimum-cell policy (e.g., suppress counts < 5 when necessary).

4) Feature engineering to support both viz and ML
Create a monthly edge-level feature table (features_edge_month) at grain: (month, from_provider_id, to_provider_id):
- Volume and lags
  - y_t = total_auths in month t
  - Lags: y_t-1, y_t-3, y_t-6, y_t-12
  - Rolling windows: mean_3m, mean_6m, std_6m, pct_change_1m, pct_change_3m
- Status-related
  - approval_rate_t, denial_rate_t, cancellation_rate_t, avg_decision_days_t
  - rolling approval_rate_3m, 6m
- Mix features
  - distribution of procedure categories (top K as numeric proportions), diagnosis groups (top K proportions), entropy of procedure mix
  - predominant requested_specialty pair (from_specialty → to_specialty)
- Provider/network context
  - out_degree_from_t (number of unique to_providers that from_provider connected to in t)
  - in_degree_to_t (number of unique from_providers that sent auths to to_provider in t)
  - weighted_out_degree_from_t = sum of y_t across edges for from
  - weighted_in_degree_to_t = sum of y_t across edges for to
  - centrality scores computed on prior months graph (see section 5)
- Seasonality/time
  - month_of_year one-hot or cyclic encoding (sin/cos)
  - year, fiscal periods
  - optional holiday flags or payer cycle flags
- Geography (if available)
  - distance between providers, same organization flags

5) Compute network analytics to showcase
Generate graph metrics from the observed network (aggregate over last 6–12 months or month-by-month if you want a temporal animation):
- Node-level
  - degree (in/out), weighted degree (sum of counts), betweenness, eigenvector/PageRank, clustering coefficient
  - community detection cluster (Louvain or Leiden) for coloring
- Edge-level
  - normalized edge weight (e.g., edge weight / total outflow from source), edge rank per source
- Store metrics
  - dim_provider_enriched: provider_id + metrics (use last 6–12 months aggregated)
  - fact_edge_month: keep current-month metrics or prior-month metrics if you want causal features

6) Forecasting/predictive overlays
Your goal: a second line on the same edge showing next-month expected volume. You can produce forecasts in a separate fact table and overlay in Tableau.

Strategy for many sparse series:
- Top-N approach (per period):
  - For edges with sufficient history and volume (e.g., ≥12 months with many nonzero points), fit per-edge univariate time series:
    - Algorithms: SARIMA/ARIMA, ETS, or Prophet; TBATS if multiple seasonality patterns exist.
- Pooled/mass approach for the long tail:
  - Use a pooled regression or ML model with count distributions:
    - Gradient Boosted Trees (LightGBM/XGBoost) with Poisson objective
    - Regularized Poisson or Negative Binomial GLM with specialty-pair effects
    - Zero-Inflated/Two-part models for sparse edges (hurdle model: logistic for nonzero vs. Poisson/NegBin for magnitude)
  - Add hierarchical effects:
    - Hierarchical Bayesian Poisson with edge-level random intercepts and specialty-pair/group random effects (borrows strength across similar edges)
- Graph-aware options (advanced):
  - Include lagged network features (in/out degree, PageRank) as predictors
  - Graph embeddings (node2vec) as features in the pooled model to learn similarity patterns
- New-edge predictions (optional showcase):
  - Link prediction for potential new relationships next month using node2vec + logistic regression (predict probability any auth occurs). Visualize as dotted, semi-transparent edges with low thickness.
- Outputs:
  - forecast_edge_month
    - month_forecasted = next month
    - from_provider_id, to_provider_id
    - y_hat (predicted auth count)
    - y_hat_lo, y_hat_hi (80/95% interval)
    - model_type and quality flags (MAPE/sMAPE/backtest score)
  - For explainability, store top features per prediction (e.g., SHAP values) for tooltips.

7) How to design the Tableau data sources
Use tidy, performant extracts. Three core tables are sufficient:
- Nodes.csv (or table)
  - provider_id, provider_name, specialty, community_id, metrics: degree, weighted_degree, betweenness, PageRank
- Edges_Actual.csv
  - month, from_provider_id, to_provider_id, total_auths, approved, denied, cancelled, unique_members, avg_decision_days, requested_specialty_mix, procedure_top_k
- Edges_Forecast.csv
  - month_forecasted, from_provider_id, to_provider_id, y_hat, y_hat_lo, y_hat_hi, model_type, forecast_flag = 1

Tableau relationships/joins:
- Relate Nodes to Edges_Actual on provider_id = from_provider_id (alias as FromNodes) and provider_id = to_provider_id (ToNodes) depending on need for node attributes in tooltips.
- Blend or relate Edges_Forecast to Edges_Actual by (from_provider_id, to_provider_id), and use month parameters to show next-month forecast vs. selected actual month.

8) Visual encoding in Tableau
- Node size: use weighted_out_degree or a hybrid score: node_size = zscore(weighted_out_degree) + 0.5*zscore(PageRank), scaled to a min/max. This highlights highly connected and influential providers.
- Edge thickness (actual): scale by total_auths for the selected month or a rolling 3-month sum. Clamp to readable bounds (e.g., 1–8 pt). Example calculation:
  - EdgeThicknessActual = 1 + 7 * (total_auths - P10) / (P90 - P10), then clamp to [1, 8].
- Edge thickness (forecast): use y_hat scaled similarly. Display as dotted or colored differently, with opacity ~50% to distinguish from actuals.
- Color:
  - Nodes by specialty or community_id
  - Edges by decision status mix or by variance vs. forecast (e.g., red if actual > forecast_hi)
- Dual-axis technique:
  - Plot actual and forecast edges as two separate lines on a dual-axis with synchronized scales; style actual as solid, forecast as dashed/dotted.
- Filters:
  - Month (or animation with Pages)
  - Specialty, decision status
  - Top-N by node degree or edge weight
- Tooltips:
  - Provider names, specialties
  - Actual volume, approval_rate, avg_decision_days
  - Forecast y_hat with confidence interval, model type, and backtest score
  - Top procedure categories for the edge

9) Extra predictive showcases (optional layers)
- Decision status prediction:
  - Train a classifier to predict approval vs. denial for next month at edge-level or auth-level; aggregate predicted approval_rate_next_month and color nodes or edges by expected approval rate.
  - Algorithms: Gradient Boosted Trees, Regularized Logistic Regression. Include procedure/diagnosis mix, historical rates, provider metrics.
- Anomaly detection:
  - Univariate: Seasonal-Hybrid ESD or STL residual z-scores on y_t
  - Multivariate: Isolation Forest on features_edge_month
  - Flag anomalies in a table and annotate in Tableau (e.g., outline nodes/edges).
- Community dynamics:
  - Compute communities by quarter; visualize changes in community membership or net-new edges above threshold.

10) Backtesting and evaluation (for credibility)
- Rolling-origin time series CV:
  - Train on months 1…k, validate on k+1; roll forward. Compute MAPE/sMAPE/Poisson deviance.
  - Store backtest metrics by edge and by specialty-pair segment; surface overall metrics in a dashboard tab labeled “Forecast Quality.”
- Calibration:
  - For Poisson/NegBin models, compare predicted vs. actual totals by month; add a calibration chart to show aggregate accuracy.

11) Performance and scope control
- Limit to top providers/edges by recent volume for the network view (e.g., top 500 nodes, top 2,000 edges), with an “Include long tail” toggle or drill.
- Aggregate rarely used edges to “Other provider” or collapse edges below a threshold to reduce clutter.
- Pre-calculate and store all metrics to avoid heavy calcs in Tableau.

12) Implementation checklist
- Build canonical tables and mappings (providers, specialties, procedures, diagnoses).
- Generate fact_edge_month and features_edge_month.
- Compute graph metrics (networkx/igraph) and store in dim_provider_enriched.
- Train forecasting:
  - Per-edge univariate for top edges; pooled Poisson/NegBin/XGBoost for long tail.
  - Produce forecast_edge_month with intervals.
- Export:
  - Nodes.csv, Edges_Actual.csv, Edges_Forecast.csv (or DB tables/extracts).
- Tableau:
  - Create network view with dual-axis edges (actual vs. forecast), node sizing, community coloring.
  - Build filters, tooltips, quality dashboard, and anomaly overlay.

Algorithm recommendations summary
- For forecasting counts:
  - Top edges: ARIMA/ETS/Prophet (univariate), TBATS if complex seasonality.
  - Long tail: XGBoost/LightGBM with Poisson objective; or Regularized (Elastic Net) Poisson/Negative Binomial GLM; optionally Zero-Inflated/Hurdle models.
  - Hierarchical option: Bayesian Poisson with provider and specialty-pair random effects to borrow strength.
- For link prediction (new edges):
  - node2vec embeddings + logistic regression/GBM.
- For decision status prediction:
  - Gradient Boosted Trees or Regularized Logistic Regression with procedure/diagnosis mix, provider metrics, historical rates.
- For anomaly detection:
  - STL residuals + z-score; or Isolation Forest on feature vectors.

Deliverables you can hand over
- Cleaned provider dimension with graph metrics and communities
- Monthly edge fact with actuals
- Forecast edge fact with point and interval predictions
- Documented data dictionary and transformation logic
- Tableau workbook with:
  - Network view (actual + forecast overlay)
  - Forecast quality tab
  - Anomalies tab
  - Specialty/community lens

This approach ensures you showcase strong data preparation, graph analytics, and predictive modeling in a single, compelling network visualization that non-technical audiences can grasp immediately.
