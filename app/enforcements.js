/* =========================================================
   ONGOING JOBS GATE
   ---------------------------------------------------------
   Enforces that Ongoing jobs are addressed before the
   planner can act on New Bookings, during a configured
   daily time window.
========================================================= */


/* =========================================================
   IS CURRENT TIME WITHIN THE GATE WINDOW
========================================================= */

function isWithinGateWindow(gateConfig) {

    const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: gateConfig.timezone,
        hour: "2-digit",
        hour12: false
    });

    const currentHour = parseInt(formatter.format(new Date()), 10);

    const startHour = gateConfig.startHour;
    const endHour = gateConfig.endHour;

    if (startHour > endHour) {
        /* Window wraps past midnight, e.g. 16 -> 8 */
        return currentHour >= startHour || currentHour < endHour;
    }

    return currentHour >= startHour && currentHour < endHour;
}


/* =========================================================
   DOES ANY ONGOING JOB EXIST
========================================================= */

function hasOngoingJobs(gateConfig) {

    return getReportRecords(
        gateConfig.reportName,
        gateConfig.criteria,
        1
    )
        .then(function(records) {
            return records.length > 0;
        });

}


/* =========================================================
   SHOULD NEW BOOKINGS BE GATED RIGHT NOW
========================================================= */

function shouldGateNewBookings() {

    const gateConfig = CONFIG.ongoingJobsGate;

    if (!gateConfig || gateConfig.enabled === false) {
        return Promise.resolve(false);
    }

    return isCurrentUserAdmin(gateConfig)
        .then(function(isAdmin) {
            if (isAdmin) {
                return false; // admins are never gated
            }

            if (!isWithinGateWindow(gateConfig)) {
                return false;
            }

            return hasOngoingJobs(gateConfig)
                .catch(function(error) {
                    console.error("Failed to check ongoing jobs for gate:", error);
                    return false; // fail open on the ongoing-jobs check itself
                });
        });

}
/* =========================================================
   IS CURRENT USER AN ADMIN
========================================================= */

function isCurrentUserAdmin(gateConfig) {

    if (typeof ZOHO === "undefined" ||
        !ZOHO.CREATOR ||
        !ZOHO.CREATOR.UTIL ||
        typeof ZOHO.CREATOR.UTIL.getInitParams !== "function") {

        console.error("getInitParams is not available on this SDK build.");
        return Promise.resolve(false);
    }

    let params;

    try {
        params = ZOHO.CREATOR.UTIL.getInitParams();
    }
    catch (error) {
        console.error("getInitParams threw an error:", error);
        return Promise.resolve(false);
    }

    console.log("Creator init params:", params);

    const loginUser = params && params.loginUser
        ? String(params.loginUser).trim().toLowerCase()
        : "";

    const adminEmails = (gateConfig.adminEmails || [])
        .map(function(email) {
            return String(email).trim().toLowerCase();
        });

    const isAdmin = adminEmails.indexOf(loginUser) !== -1;

    console.log("Logged in user:", loginUser);
    console.log("Configured admins:", adminEmails);
    console.log("Is admin:", isAdmin);

    return Promise.resolve(isAdmin);
}
/* =========================================================
   PAST BOOKINGS ENFORCEMENT
========================================================= */

function hasPastBookings(records) {
    return (records || []).some(function(record) {
        return record._bookingGroup === "Past";
    });
}
/* =========================================================
   NOT STARTED JOBS GATE (09:00 - 13:00)
   ---------------------------------------------------------
   While any job exists in Not Started, every other tab is
   inactionable. Applies to all users, all booking dates.
========================================================= */

let notStartedGateActive = false;

function refreshNotStartedGate() {
    const gateConfig = CONFIG.notStartedGate;

    if (!gateConfig || gateConfig.enabled === false || !isWithinGateWindow(gateConfig)) {
        notStartedGateActive = false;
        return Promise.resolve(false);
    }

    const source = CONFIG.notStartedJobs;
    const todayISO = getNairobiTodayISO();

    return getAllReportRecords(source.reportName, source.criteria)
        .then(function(records) {
            return records.some(function(record) {
                const rawDate = getDisplayValue(record, gateConfig.dateField);
                const moveISO = parseCreatorDateToISO(rawDate);

                if (!moveISO) {
                    console.warn("Could not parse move date for Not Started gate:", rawDate, record.ID);
                    return false;
                }

                return moveISO <= todayISO;
            });
        })
        .catch(function(error) {
            console.error("Failed to check Not Started jobs for gate:", error);
            return false; /* fail open */
        })
        .then(function(active) {
            notStartedGateActive = active;
            return active;
        });
}
function renderTabActions(record, tabId) {
    if (notStartedGateActive && tabId !== "planApproveTab") {
        return '<span class="gate-message">Update Not Started jobs to continue</span>';
    }

    if (dispatchedGateActive && tabId !== "dispatchedJobsTab") {
        return '<span class="gate-message">Update Dispatched jobs to continue</span>';
    }

    return renderBlueprintActions(record);
}

function getActiveTabId() {
    const active = document.querySelector(".tab-content.active");
    return active ? active.id : null;
}

function showTabGateModalIfNeeded(tabId) {
    if (notStartedGateActive && tabId !== "planApproveTab") {
        showInfoModal(
            "Not Started Jobs Require Attention",
            "Ensure you update today's and past jobs in the Not Started tab to continue",
            function() { activateTab("planApproveTab"); }
        );
        return;
    }

    if (dispatchedGateActive && tabId !== "dispatchedJobsTab") {
        showInfoModal(
            "Dispatched Jobs Require Attention",
            "Ensure you update today's and past jobs in the dispatched stage",
            function() { activateTab("dispatchedJobsTab"); }
        );
        return;
    }

    if (tabId === "confirmBookingsTab" && pastBookingsGateActive) {
        showInfoModal(
            "Past Bookings Require Attention",
            "Kindly attend to the Past bookings to access new bookings."
        );
    }
}

function showActiveTabGateModal() {
    showTabGateModalIfNeeded(getActiveTabId());
}
/* =========================================================
   DISPATCHED JOBS GATE (14:00 - 16:00)
   ---------------------------------------------------------
   While any job exists in Dispatched, every other tab is
   inactionable. Applies to all users, all booking dates.
========================================================= */

let dispatchedGateActive = false;

function refreshDispatchedGate() {
    const gateConfig = CONFIG.dispatchedGate;

    if (!gateConfig || gateConfig.enabled === false || !isWithinGateWindow(gateConfig)) {
        dispatchedGateActive = false;
        return Promise.resolve(false);
    }

    const source = CONFIG.dispatchedJobs;
    const todayISO = getNairobiTodayISO();

    return getAllReportRecords(source.reportName, source.criteria)
        .then(function(records) {
            return records.some(function(record) {
                const rawDate = getDisplayValue(record, gateConfig.dateField);
                const moveISO = parseCreatorDateToISO(rawDate);

                if (!moveISO) {
                    console.warn("Could not parse move date for Dispatched gate:", rawDate, record.ID);
                    return false;
                }

                return moveISO <= todayISO;
            });
        })
        .catch(function(error) {
            console.error("Failed to check Dispatched jobs for gate:", error);
            return false; /* fail open */
        })
        .then(function(active) {
            dispatchedGateActive = active;
            return active;
        });
}

function refreshGates() {
    return Promise.all([
        refreshNotStartedGate(),
        refreshDispatchedGate()
    ]);
}

function getGateState() {
    return (notStartedGateActive ? "N" : "") + (dispatchedGateActive ? "D" : "");
}