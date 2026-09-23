/* =========================================================
   CREATOR API LAYER
========================================================= */


/* =========================================================
   GET REPORT RECORDS
========================================================= */

function getReportRecords(reportName, criteria, pageSize) {
    const config = {
        reportName: reportName,
        criteria: criteria,
        page: 1,
        pageSize: pageSize || 200
    };

    return ZOHO.CREATOR.API.getAllRecords(config)
        .then(function(response) {
            return response.data || [];
        })
        .catch(function(error) {
            let is3100 = false;

            try {
                const parsed = JSON.parse(error.responseText || "{}");
                is3100 = parsed.code === 3100;
            } catch (parseErr) {
                /* not JSON, fall through as a real error */
            }

            if (is3100) {
                return [];
            }

            throw error;
        });
}


/* =========================================================
   GET INDIVIDUAL RECORD
========================================================= */

function getRecordById(reportName, recordId) {
    const config = {
        reportName: reportName,
        id: recordId,
    };

    return ZOHO.CREATOR.API.getRecordById(config)
        .then(function(response) {
            return response.data || null;
        });
}


/* =========================================================
   UPDATE CREATOR RECORD
========================================================= */
function updateCreatorRecord(reportName, recordId, data) {
    const config = {
        reportName: reportName,
        id: recordId,
        data: { data: data }
    };

    return ZOHO.CREATOR.API.updateRecord(config)
        .then(function(response) {
            if (!response || response.code !== 3000) {
                const message = response && response.error
                    ? Object.values(response.error).join(", ")
                    : "Creator record update failed.";

                throw new Error(message);
            }

            return response;
        });
}
/* =========================================================
   GENERIC EXECUTE BLUEPRINT TRANSITION
========================================================= */
function executeBlueprintTransition(apiKey, recordId, transitionName, blueprintType) {
    const apiConfig = CONFIG[apiKey];

    const payload = {
        TransitionName: transitionName,
        BlueprintType: blueprintType
    };

    payload[apiConfig.idParam] = String(recordId);

    const config = {
        api_name: apiConfig.apiName,
        workspace_name: apiConfig.workspaceName,
        http_method: "POST",
        content_type: "application/json",
        payload: payload,
        public_key: apiConfig.publicKey
    };

    return ZOHO.CREATOR.API.invokeCustomApi(config)
        .then(function(response) {
            const result =
                response && response.result
                    ? response.result
                    : response;

            if (result && result.success === false) {
                throw new Error(
                    result.message || "Blueprint transition failed."
                );
            }

            return result;
        });
}
/* =========================================================
   GET ALL REPORT RECORDS (PAGINATED)
========================================================= */

function getAllReportRecords(reportName, criteria) {
    const pageSize = 200;

    function loadPage(page, accumulated) {
        const config = {
            reportName: reportName,
            page: page,
            pageSize: pageSize
        };

        if (criteria) {
            config.criteria = criteria;
        }

        return ZOHO.CREATOR.API.getAllRecords(config)
            .then(function(response) {
                const records = response && response.data ? response.data : [];
                const combined = accumulated.concat(records);

                if (records.length === pageSize) {
                    return loadPage(page + 1, combined);
                }

                return combined;
            })
            .catch(function(error) {
                let is3100 = false;

                try {
                    const parsed = JSON.parse(error.responseText || "{}");
                    is3100 = parsed.code === 3100;
                } catch (parseErr) {
                    /* not JSON, fall through as a real error */
                }

                if (is3100) {
                    return accumulated;
                }

                throw error;
            });
    }

    return loadPage(1, []);
}
const BLUEPRINT_STAGE_ALIASES = {
    Ongoingg: "Ongoing",
    Dispatchedd: "Dispatched"
};

function normalizeBlueprintStage(stage) {
    return BLUEPRINT_STAGE_ALIASES[stage] || stage;
}

function normalizeBlueprintState(record) {
    const rawStage = record["Blueprint.Current_Stage"]
        ? record["Blueprint.Current_Stage"].display_value
        : null;

    record._rawBlueprintStage = rawStage;
    record._blueprintStage = normalizeBlueprintStage(rawStage);

    record._blueprintName = record["Blueprint.Name"]
        ? record["Blueprint.Name"].display_value.toLowerCase().replace(/\s+/g, "_")
        : null;

    record._blueprintStatus = record["Blueprint.Status"]
        ? record["Blueprint.Status"].display_value
        : null;

    return record;
}
