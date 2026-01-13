export type AAMetricId =
  | 'metrics/averagepagedepth'
  | 'metrics/averagetimespentonpage'
  | 'metrics/averagetimespentonsite'
  | 'metrics/averagevisitdepth'
  | 'metrics/bouncerate'
  | 'metrics/bounces'
  | 'metrics/clickmaplinkbyregioninstances'
  | 'metrics/clickmaplinkinstances'
  | 'metrics/clickmappageinstances'
  | 'metrics/clickmapregioninstances'
  | 'metrics/entries'
  | 'metrics/evar100instances'
  | 'metrics/evar10instances'
  | 'metrics/evar110instances'
  | 'metrics/evar111instances'
  | 'metrics/evar112instances'
  | 'metrics/evar11instances'
  | 'metrics/evar120instances'
  | 'metrics/evar121instances'
  | 'metrics/evar122instances'
  | 'metrics/evar123instances'
  | 'metrics/evar124instances'
  | 'metrics/evar125instances'
  | 'metrics/evar129instances'
  | 'metrics/evar12instances'
  | 'metrics/evar130instances'
  | 'metrics/evar131instances'
  | 'metrics/evar132instances'
  | 'metrics/evar133instances'
  | 'metrics/evar134instances'
  | 'metrics/evar135instances'
  | 'metrics/evar13instances'
  | 'metrics/evar14instances'
  | 'metrics/evar15instances'
  | 'metrics/evar16instances'
  | 'metrics/evar17instances'
  | 'metrics/evar18instances'
  | 'metrics/evar19instances'
  | 'metrics/evar1instances'
  | 'metrics/evar20instances'
  | 'metrics/evar21instances'
  | 'metrics/evar22instances'
  | 'metrics/evar23instances'
  | 'metrics/evar24instances'
  | 'metrics/evar25instances'
  | 'metrics/evar26instances'
  | 'metrics/evar27instances'
  | 'metrics/evar28instances'
  | 'metrics/evar29instances'
  | 'metrics/evar2instances'
  | 'metrics/evar30instances'
  | 'metrics/evar31instances'
  | 'metrics/evar32instances'
  | 'metrics/evar33instances'
  | 'metrics/evar34instances'
  | 'metrics/evar35instances'
  | 'metrics/evar37instances'
  | 'metrics/evar38instances'
  | 'metrics/evar39instances'
  | 'metrics/evar40instances'
  | 'metrics/evar41instances'
  | 'metrics/evar42instances'
  | 'metrics/evar43instances'
  | 'metrics/evar44instances'
  | 'metrics/evar45instances'
  | 'metrics/evar46instances'
  | 'metrics/evar4instances'
  | 'metrics/evar50instances'
  | 'metrics/evar51instances'
  | 'metrics/evar52instances'
  | 'metrics/evar53instances'
  | 'metrics/evar54instances'
  | 'metrics/evar55instances'
  | 'metrics/evar57instances'
  | 'metrics/evar59instances'
  | 'metrics/evar5instances'
  | 'metrics/evar61instances'
  | 'metrics/evar62instances'
  | 'metrics/evar63instances'
  | 'metrics/evar65instances'
  | 'metrics/evar66instances'
  | 'metrics/evar6instances'
  | 'metrics/evar70instances'
  | 'metrics/evar71instances'
  | 'metrics/evar72instances'
  | 'metrics/evar75instances'
  | 'metrics/evar76instances'
  | 'metrics/evar77instances'
  | 'metrics/evar78instances'
  | 'metrics/evar79instances'
  | 'metrics/evar80instances'
  | 'metrics/evar86instances'
  | 'metrics/evar87instances'
  | 'metrics/evar88instances'
  | 'metrics/evar89instances'
  | 'metrics/evar8instances'
  | 'metrics/evar90instances'
  | 'metrics/evar91instances'
  | 'metrics/evar92instances'
  | 'metrics/evar93instances'
  | 'metrics/evar94instances'
  | 'metrics/evar95instances'
  | 'metrics/evar96instances'
  | 'metrics/evar9instances'
  | 'metrics/event100'
  | 'metrics/event1000'
  | 'metrics/event101'
  | 'metrics/event102'
  | 'metrics/event11'
  | 'metrics/event110'
  | 'metrics/event12'
  | 'metrics/event120'
  | 'metrics/event20'
  | 'metrics/event25'
  | 'metrics/event26'
  | 'metrics/event27'
  | 'metrics/event28'
  | 'metrics/event29'
  | 'metrics/event30'
  | 'metrics/event31'
  | 'metrics/event32'
  | 'metrics/event42'
  | 'metrics/event50'
  | 'metrics/event51'
  | 'metrics/event52'
  | 'metrics/event53'
  | 'metrics/event54'
  | 'metrics/event57'
  | 'metrics/event58'
  | 'metrics/event59'
  | 'metrics/event61'
  | 'metrics/event62'
  | 'metrics/event63'
  | 'metrics/event64'
  | 'metrics/event69'
  | 'metrics/event70'
  | 'metrics/event71'
  | 'metrics/event72'
  | 'metrics/event73'
  | 'metrics/event74'
  | 'metrics/event75'
  | 'metrics/event76'
  | 'metrics/event78'
  | 'metrics/event79'
  | 'metrics/event80'
  | 'metrics/event81'
  | 'metrics/event82'
  | 'metrics/event83'
  | 'metrics/event84'
  | 'metrics/event85'
  | 'metrics/event9'
  | 'metrics/event91'
  | 'metrics/event92'
  | 'metrics/event999'
  | 'metrics/exitlinkinstances'
  | 'metrics/exits'
  | 'metrics/firsttouchchannel.1'
  | 'metrics/firsttouchchannel.2'
  | 'metrics/firsttouchchannel.3'
  | 'metrics/firsttouchchannel.4'
  | 'metrics/itemtimespent'
  | 'metrics/marketingchannellasttouchinstances'
  | 'metrics/newengagements'
  | 'metrics/occurrences'
  | 'metrics/pageviews'
  | 'metrics/pageviewspervisit'
  | 'metrics/referrerinstances'
  | 'metrics/reloads'
  | 'metrics/searches'
  | 'metrics/singlepagevisits'
  | 'metrics/timespentvisit'
  | 'metrics/timespentvisitor'
  | 'metrics/visitors'
  | 'metrics/visitorsmcvisid'
  | 'metrics/visitorsmonthly'
  | 'metrics/visits';

export type CalculatedMetricId = |
  'cm300000938_5be205840c00c502875416bf' | // RAP_CANT_FIND
  'cm300000938_5be205840c00c502875416be' | // RAP_LOGIN_ERROR
  'cm300000938_5be20584c66baa7dda682e80' | // RAP_OTHER
  'cm300000938_5be205847122f93cfbacf190' | // RAP_SIN
  'cm300000938_5be2058465802258e90da8d7' | // RAP_INFO_MISSING
  'cm300000938_5be205845759f05da544c860' | // RAP_SECUREKEY
  'cm300000938_5be20585f4b4b97693450ea3' | // RAP_OTHER_LOGIN
  'cm300000938_5be20584fd66954d322dbdc3' | // RAP_GC_KEY
  'cm300000938_5be205845595bc5e15147034' | // RAP_INFO_WRONG
  'cm300000938_5be20584f4b4b97693450e9d' | // RAP_SPELLING
  'cm300000938_5be205845595bc5e15147033' | // RAP_ACCESS_CODE
  'cm300000938_5be20584d73387096a40a7f7' | // RAP_LINK_NOT_WORKING
  'cm300000938_5d41aeae7b5c727e37cadf5f' | // RAP_404
  'cm300000938_5be205847e27304437eed321' | // RAP_BLANK_FORM
  // Did you find what you were looking for?
  'cm300000938_62027221da83db49ec984fac' | // FWYLF_CANT_FIND_INFO
  'cm300000938_620277d665dc0c1f6cd1adbf' | // FWYLF_OTHER
  'cm300000938_620276e57af5584604585ced' | // FWYLF_HARD_TO_UNDERSTAND
  'cm300000938_620277b665dc0c1f6cd1adbe' | // FWYLF_ERROR
  // Provincial Data Visits
  'cm300000938_5e9dfecb8fadd45909cf1861' | // GEO_AB
  'cm300000938_5e9dfe97e952632604408cc8' | // GEO_BC
  'cm300000938_5e9dfefeaf2fdb37b7be2119' | // GEO_MB
  'cm300000938_5e9dff85fdc00a04b63e1bbd' | // GEO_NB
  'cm300000938_5e9dffab0d087502cdf70dd3' | // GEO_NFL
  'cm300000938_5e9dff55e8836d5d62d68901' | // GEO_NS
  'cm300000938_5e9e00327f17335cfa696fba' | // GEO_NWT
  'cm300000938_5e9e0063e952632604408d82' | // GEO_NV
  'cm300000938_5e9dfe58abb30003ef9bbacb' | // GEO_ON
  'cm300000938_5fca5769adfda27f107ed94e' | // GEO_OUTSIDE_CANADA
  'cm300000938_5e9dffe2fdc00a04b63e1bd1' | // GEO_PEI
  'cm300000938_5e9dfe60af2fdb37b7be20f2' | // GEO_QC
  'cm300000938_5e9dff2b8fadd45909cf188a' | // GEO_SK
  'cm300000938_5e9e000f3cf9f652a1335b99' | // GEO_YK
  'cm300000938_61f95705ab91fc3247bcb2f4' | // GEO_US
  // Referring Types
  'cm300000938_5fca904d67f9144796cd5c4f' | // REF_OTHER_WEBSITES
  'cm300000938_5fca90275d1f715277602cc3' | // REF_SEARCH_ENGINE
  'cm300000938_5fca90a467f9144796cd5c50' | // REF_SOCIAL_NETWORKS
  'cm300000938_5fca90c24308567206e23fad' | // REF_TYPED_BOOKMARKS
  'cm300000938_68fbc9a7ca338753e868b7f2' | // REF_CONVO_AI
  // Devices Types
  'cm300000938_5ec605734c546630df64a183' | // DEVICES_OTHER
  'cm300000938_5ec603fa86fd4d00d83b4ae7' | // DEVICES_DESKTOP
  'cm300000938_5ec603c086fd4d00d83b4adb' | // DEVICES_MOBILE
  'cm300000938_5ec6041b4c546630df64a161' | // DEVICES_TABLET
  // Time Spent on Page (Visits)
  'cm300000938_62a39491f51dca5fb72736f0' | // TIME_LESSTHAN15SEC
  'cm300000938_62a394d3f51dca5fb72736f1' | // TIME_15TO29SEC
  'cm300000938_62a39503f51dca5fb72736f2' | // TIME_30TO59SEC
  'cm300000938_62a39521f51dca5fb72736f3' | // TIME_1TO3MIN
  'cm300000938_62a395498ee8735b4868005c' | // TIME_3TO5MIN
  'cm300000938_62a395655bec3c26817454fa' | // TIME_5TO10MIN
  'cm300000938_62a395895bec3c26817454fb' | // TIME_10TO15MIN
  'cm300000938_62a395a55bec3c26817454fc' | // TIME_15TO20MIN
  'cm300000938_62a395c511f9c0642390482b' | // TIME_20TO30MIN
  'cm300000938_62a395f34333af490687dd02' | // TIME_MORETHAN30MIN
  // Average search rank
  'cm300000938_5b437b86b7204e079e96509f'
