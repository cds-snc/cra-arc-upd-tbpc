/* eslint-disable */
declare module '@adobe/aio-lib-analytics' {
  /**
   * Returns a Promise that resolves with a new AnalyticsCoreAPI object.
   *
   * @param companyId {string} company ID to be used with Adobe Analytics.
   * @param apiKey {string} Your api key
   * @param token {string} Valid auth token
   * @returns {Promise<AnalyticsCoreAPI>}
   */
  export function init(
    companyId: string,
    apiKey: string,
    token: string,
  ): Promise<AnalyticsCoreAPI>;
  /**
   * This class provides methods to call Adobe Analytics APIs.
   * Before calling any method initialize the instance by calling init method on it
   * with valid company id, apiKey and auth token
   */
  declare class AnalyticsCoreAPI {
    /** Initialize sdk.
     *
     * @param companyId {string} company ID to be used with Adobe Analytics.
     * @param apiKey {string} Your api key
     * @param token {string} Valid auth token
     * @returns {AnalyticsCoreAPI}
     */
    init(companyId: string, apiKey: string, token: string): AnalyticsCoreAPI;
    sdk: any;
    companyId: string;
    apiKey: string;
    token: string;
    /** Retrieve many calculated metrics.
     * A calculated metric response will always include these default items: *id, name, description, rsid, owner, polarity, precision, type
     * Other attributes can be optionally requested through the 'expansion' field:\n\n*
     *     modified: Date that the metric was last modified (ISO 8601)
     *     definition: Calculated metric definition as JSON object
     *     compatibility: Products that the metric is compatible with
     *     reportSuiteName*: Also return the friendly Report Suite name for the RSID
     *     tags*: Gives all existing tags associated with the calculated metric
     *
     * For more information about calculated metrics go [here](https://github.com/AdobeDocs/analytics-2.0-apis/blob/master/calculatedmetrics.md)
     *
     * @param options {Object} to control calculated metrics search.
     * @param options.calculatedMetricFilter Filter list to only include calculated metrics in the specified list\n(comma-delimited list of IDs).
     * @param options.expansion Comma-delimited list of additional metadata fields\nto include on response.
     * @param options.limit Number of results per page. Default 10.
     * @param options.locale Locale.
     * @param options.name Filter list to only include calculated metrics that contains the Name.
     * @param options.ownerId Filter list to only include calculated metrics owned by the\nspecified loginId.
     * @param options.page Page number (base 0 - first page is \"0\"). Default 0.
     * @param options.rsids Filter list to only include calculated metrics tied to specified\nRSID list (comma-delimited).
     * @param options.tagNames Filter list to only include calculated metrics that contains one of\nthe tags.
     */
    getCalculatedMetrics(
      {
        calculatedMetricFilter,
        expansion,
        limit,
        locale,
        name,
        ownerId,
        page,
        rsids,
        tagNames,
      }?: {
        calculatedMetricFilter: any;
        expansion: any;
        limit: any;
        locale: any;
        name: any;
        ownerId: any;
        page: any;
        rsids: any;
        tagNames: any;
      },
      ...args: any[]
    ): Promise<any>;
    /** Retrieve a single calculated metric by id.
     * A calculated metric response will always include these default items: *id, name, description, rsid, owner, polarity, precision, type
     * Other attributes can be optionally requested through the 'expansion' field:\n\n*
     *     modified: Date that the metric was last modified (ISO 8601)
     *     definition: Calculated metric definition as JSON object
     *     compatibility: Products that the metric is compatible with
     *     reportSuiteName*: Also return the friendly Report Suite name for the RSID
     *     tags*: Gives all existing tags associated with the calculated metric
     *
     * For more information about calculated metrics go [here](https://github.com/AdobeDocs/analytics-2.0-apis/blob/master/calculatedmetrics.md)
     * @param id {string} The calculated metric ID to retrieve.
     * @param options {Object} to control calculated metric result
     * @param options.expansion Comma-delimited list of additional metadata fields\nto include on response.
     * @param options.locale Locale.
     */
    getCalculatedMetricById(
      id: string,
      {
        expansion,
        locale,
      }?: {
        expansion: any;
        locale: any;
      },
      ...args: any[]
    ): Promise<any>;
    /** Retrieves report suites that match the given filters.
     * Returns all report suite types in a single collection.
     *
     * @param options {Object} to control report suites search.
     * @param options.expansion Comma-delimited list of additional metadata fields to include on\nresponse.
     * @param options.limit Number of results per page. Default 10.
     * @param options.page Page number (base 0 - first page is \"0\"). Default 0.
     * @param options.rsids Filter list to only include suites in this RSID list\n(comma-delimited).
     * @param options.rsidContains Filter list to only include suites whose rsid contains rsidContains.
     */
    getCollections(
      {
        expansion,
        limit,
        page,
        rsidContains,
        rsids,
      }?: {
        expansion: any;
        limit: any;
        page: any;
        rsids: any;
        rsidContains: any;
      },
      ...args: any[]
    ): Promise<any>;
    /** Retrieves report suite by id.
     * Returns all report suite types in a single collection.
     *
     * @param rsid {string} The rsid of the suite to return.
     * @param options {Object} to control eport suites search.
     * @param options.expansion Comma-delimited list of additional metadata fields to include on\nresponse.
     */
    getCollectionById(
      rsid: string,
      {
        expansion,
      }?: {
        expansion: any;
      },
      ...args: any[]
    ): Promise<any>;
    /** Returns a list of dateranges for the user.
     * This function allows users to store commonly used date ranges so that they\ncan be reused throughout the product.
     *
     * @param options {Object} to control date range search.
     * @param options.expansion Comma-delimited list of additional metadata fields to include on\nresponse.
     * @param options.filterByIds Filter list to only include date ranges in the specified list\n(comma-delimited list of IDs).
     * @param options.limit Number of results per page. Default 10.
     * @param options.locale Locale.
     * @param options.page Page number (base 0 - first page is \"0\"). Default 0.
     */
    getDateRanges(
      {
        expansion,
        filterByIds,
        limit,
        locale,
        page,
      }?: {
        expansion: any;
        filterByIds: any;
        limit: any;
        locale: any;
        page: any;
      },
      ...args: any[]
    ): Promise<any>;
    /** Retrieves configuration for a DateRange..
     *
     * @param dateRangeId {string} The DateRange id for which to retrieve information.
     * @param options {Object} to control date range result.
     * @param options.expansion Comma-delimited list of additional metadata fields to include on\nresponse.
     * @param options.locale Locale.
     */
    getDateRangeById(
      dateRangeId: string,
      {
        expansion,
        locale,
      }?: {
        expansion: any;
        locale: any;
      },
      ...args: any[]
    ): Promise<any>;
    /** Returns a list of dimensions for a given report suite.
     *
     * @param rsid {string} A Report Suite ID.
     * @param options {Object} to control dimensions search.
     * @param options.classifiable Only include classifiable dimensions.
     * @param options.expansion Comma-delimited list of additional metadata fields\nto include on response.
     * @param options.locale Locale.
     * @param options.reportable Only include dimensions that are valid within a report.
     * @param options.segmentable Only include dimensions that are valid within a segment.
     */
    getDimensions(
      rsid: string,
      {
        classifiable,
        expansion,
        locale,
        reportable,
        segmentable,
      }?: {
        classifiable: any;
        expansion: any;
        locale: any;
        reportable: any;
        segmentable: any;
      },
      ...args: any[]
    ): Promise<any>;
    /** Returns a dimension for the given report suite and dimension Id.
     *
     * @param dimensionId {string} The dimension ID. For example a valid id is a value like 'evar1'.
     * @param rsid {string} A Report Suite ID.
     * @param options {Object} to control dimension result.
     * @param options.expansion Comma-delimited list of additional metadata fields\nto include on response.
     * @param options.locale Locale.
     */
    getDimensionById(
      dimensionId: string,
      rsid: string,
      {
        expansion,
        locale,
      }?: {
        expansion: any;
        locale: any;
      },
      ...args: any[]
    ): Promise<any>;
    /** Returns a list of metrics for the given report suite.
     * This returns the metrics list primarily for the Analytics product.
     * The platform identity API Returns a list of all possible metrics for the supported systems.
     *
     * @param rsid {string} A Report Suite ID.
     * @param options {Object} to control dimension result.
     * @param options.expansion Comma-delimited list of additional metadata fields\nto include on response.
     * @param options.locale Locale that system named metrics should be returned in.
     * @param options.segmentable Filter the metrics by if they are valid in a segment.
     */
    getMetrics(
      rsid: string,
      {
        expansion,
        locale,
        segmentable,
      }?: {
        expansion: any;
        locale: any;
        segmentable: any;
      },
      ...args: any[]
    ): Promise<any>;
    /** Returns a metric for the given report suite.
     * This returns the metrics list primarily for the Analytics product.
     * The platform identity API Returns a list of all possible metrics for the supported systems.
     *
     * @param id {string} The id of the metric for which to retrieve info. Note ids are values\nlike pageviews, not metrics/pageviews.
     * @param rsid {string} A Report Suite ID.
     * @param options {Object} to control dimension result.
     * @param options.expansion Comma-delimited list of additional metadata fields\nto include on response.
     * @param options.locale Locale that system named metrics should be returned in.
     */
    getMetricById(
      id: string,
      rsid: string,
      {
        expansion,
        locale,
      }?: {
        expansion: any;
        locale: any;
      },
      ...args: any[]
    ): Promise<any>;
    /** Runs a report for the request.
     * See the [Reporting User Guide](https://github.com/AdobeDocs/analytics-2.0-apis/blob/master/reporting-guide.md) for details.
     *
     * @param body {Object} report query.
     */
    getReport(body: any): Promise<any>;
    /** Retrieve All Segments.
     *
     * @param options {Object} to control segments search.
     * @param options.expansion Comma-delimited list of additional metadata fields\nto include on response.
     * @param options.includeType Include additional segments not owned by user. The \"all\" option\ntakes precedence over \"shared\".
     * @param options.limit Number of results per page. Default 10.
     * @param options.locale Locale that system named metrics should be returned in.
     * @param options.name Filter list to only include segments that contains the Name.
     * @param options.page Page number (base 0 - first page is \"0\"). Default 0.
     * @param options.rsids Filter list to only include segments tied to specified RSID list (comma-delimited).
     * @param options.segmentFilter Filter list to only include segments in the specified list (comma-delimited list of IDs).
     * @param options.tagNames Filter list to only include segments that contains one of the tags.
     */
    getSegments(
      {
        expansion,
        includeType,
        limit,
        locale,
        name,
        page,
        rsids,
        segmentFilter,
        tagNames,
      }?: {
        expansion: any;
        includeType: any;
        limit: any;
        locale: any;
        name: any;
        page: any;
        rsids: any;
        segmentFilter: any;
        tagNames: any;
      },
      ...args: any[]
    ): Promise<any>;
    /** Validate a Segment.
     * Returns a segment validation for the segment contained in the post body of the report.
     *
     * @param rsid {string} A Report Suite ID.
     * @param body {Object} JSON Segment Definition.
     */
    validateSegment(rsid: string, body: any): Promise<any>;
    /** Returns a list of users for the current user's login company.
     * Retrieves a list of all users for the company designated by the auth\ntoken.
     *
     * @param options {Object} to control user search.
     * @param options.limit Number of results per page. Default 10.
     * @param options.page Page number (base 0 - first page is \"0\"). Default 0.
     */
    getUsers(
      {
        limit,
        page,
      }?: {
        limit: any;
        page: any;
      },
      ...args: any[]
    ): Promise<any>;
    /** Get the current user. */
    getCurrentUser(): Promise<any>;
    /** Retrieves usage and access logs for the search criteria provided.
     * This API returns the usage and access logs for a given date range within a 3 month period. This API authenticates with an IMS user token.
     *
     * @param startDate {string} Start date in ISO-8601 format for the maximum of a 3 month period.
     * @param endDate {string} End date in ISO-8601 format for the maximum of a 3 month period.
     * @param options {Object} options to filter logs.
     * @param options.login {string} The login value of the user you want to filter logs by.
     * @param options.ip {string} The IP address you want to filter logs by.
     * @param options.rsid {string} The report suite ID you want to filter logs by.
     * @param options.eventType {string} The numeric id for the event type you want to filter logs by.
     * @param options.event {string} The event description you want to filter logs by. No wildcards permitted.
     * @param options.limit {number} Number of results per page. Default 10.
     * @param options.page {number} Page number (base 0 - first page is \"0\"). Default 0.
     */
    getUsageLogs(
      startDate: string,
      endDate: string,
      options?: {
        login: string;
        ip: string;
        rsid: string;
        eventType: string;
        event: string;
        limit: number;
        page: number;
      },
    ): Promise<any>;
    __createRequest(
      body: any,
      query: any,
    ): {
      requestBody: any;
      server: string;
      serverVariables: {
        companyId: string;
      };
    };
    __setHeaders(req: any, coreAPIInstance: any): void;
  }
}


