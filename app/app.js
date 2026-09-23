/* =========================================================
   BOOKINGS OPERATIONS APPLICATION
========================================================= */

/* =========================================================
   APPLICATION START
========================================================= */
let pastBookingsGateActive = false;
let activeDuringActionContext = null;
ZOHO.CREATOR.init()
    .then(function() {
        initializeTabs();
        loadOngoingJobs();
        loadBookingsToConfirm();
        loadNotStartedJobs();
        loadDispatchedJobs();
    })
    .catch(function(error) {
        console.error("Creator SDK initialization failed:", error);
        showError("ongoingJobsContainer", "Unable to initialize Creator SDK.");
        showError("confirmBookingsContainer", "Unable to initialize Creator SDK.");
        showError("notStartedJobsContainer", "Unable to initialize Creator SDK.");
    });


/* =========================================================
   TAB HANDLING
========================================================= */
function initializeTabs() {
    document.querySelectorAll(".tab-button").forEach(function(button) {
        button.addEventListener("click", function() {
            const targetTab = button.getAttribute("data-tab");

            document.querySelectorAll(".tab-button").forEach(function(tabButton) {
                tabButton.classList.remove("active");
            });

            document.querySelectorAll(".tab-content").forEach(function(tabContent) {
                tabContent.classList.remove("active");
            });

            button.classList.add("active");
            document.getElementById(targetTab).classList.add("active");

            if (targetTab === "confirmBookingsTab" && pastBookingsGateActive) {
                showInfoModal(
                    "Past Bookings Require Attention",
                    "Kindly attend to the Past bookings to access new bookings."
                );
            }
        });
    });
}
/* =========================================================
   CURRENT ONGOING JOBS
========================================================= */

function loadOngoingJobs() {
    const config = CONFIG.ongoingJobs;

    getReportRecords(config.reportName, config.criteria, config.pageSize)
        .then(function(records) {

            records.forEach(function(record) {
                normalizeBlueprintState(record);
            });

            renderOngoingJobs(records);
        })
        .catch(function(error) {
            console.error("Failed to load ongoing jobs:", error);
            showError("ongoingJobsContainer", "Unable to load ongoing jobs.");
            document.getElementById("ongoingCount").textContent = "Error";
        });
}

/* =========================================================
   RENDER CURRENT ONGOING JOBS
========================================================= */

function renderOngoingJobs(records) {
    const container = document.getElementById("ongoingJobsContainer");

    document.getElementById("ongoingCount").textContent =
        records.length + " record" + (records.length === 1 ? "" : "s");

    if (!records.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-title">
                    No ongoing jobs
                </div>

                <div class="empty-message">
                    There are currently no jobs with Ongoing status.
                </div>
            </div>
        `;

        return;
    }

    const columns = CONFIG.ongoingJobs.columns;

    let html = `
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
    `;

    columns.forEach(function(column) {
        html += `
            <th>
                ${escapeHtml(column.label)}
            </th>
        `;
    });

    html += `
        <th>
            Actions
        </th>
    `;

    html += `
                    </tr>
                </thead>

                <tbody>
    `;

    records.forEach(function(record) {
        html += "<tr>";

        columns.forEach(function(column) {
            const value = getDisplayValue(record, column.field);

            if (column.field === "_blueprintStage") {
                html += `
                    <td>
                        <span class="status-badge status-ongoing">
                            ${escapeHtml(value)}
                        </span>
                    </td>
                `;
            }
            else {
                html += `
                    <td>
                        ${escapeHtml(value)}
                    </td>
                `;
            }
        });

        html += `
            <td>
                ${renderBlueprintActions(record)}
            </td>
        `;

        html += "</tr>";
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = html;
}


/* =========================================================
   BOOKINGS TO CONFIRM
========================================================= */
function loadBookingsToConfirm() {
    const config = CONFIG.bookingsToConfirm;

    Promise.all([
        getReportRecords(config.reportName, config.criteria, config.pageSize),
        shouldGateNewBookings()
    ])
        .then(function(results) {
            const records = results[0];
            const ongoingGate = results[1];

            records.forEach(function(record) {
                record._blueprintName = record["Blueprint.Name"]
                    ? record["Blueprint.Name"].display_value.toLowerCase().replace(/\s+/g, "_")
                    : null;

                record._blueprintStage = record["Blueprint.Current_Stage"]
                    ? record["Blueprint.Current_Stage"].display_value
                    : null;

                record._blueprintStatus = record["Blueprint.Status"]
                    ? record["Blueprint.Status"].display_value
                    : null;

                record._bookingGroup = computeBookingGroup(record, config.dateField);
            });

            pastBookingsGateActive = hasPastBookings(records);

            renderBookingsToConfirm(records, ongoingGate, pastBookingsGateActive);

            const newBookingsTab = document.getElementById("confirmBookingsTab");

            if (newBookingsTab &&
                newBookingsTab.classList.contains("active") &&
                pastBookingsGateActive) {
                showInfoModal(
                    "Past Bookings Require Attention",
                    "Kindly attend to the Past bookings to access new bookings."
                );
            }
        })
        .catch(function(error) {
            console.error("Failed to load bookings:", error);
            showError("confirmBookingsContainer", "Unable to load bookings to confirm.");
            document.getElementById("confirmCount").textContent = "Error";
        });
}


/* =========================================================
   BOOKING DATE GROUPING HELPERS
========================================================= */

const MONTH_ABBR_TO_NUM = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04",
    May: "05", Jun: "06", Jul: "07", Aug: "08",
    Sep: "09", Oct: "10", Nov: "11", Dec: "12"
};

function parseCreatorDateToISO(value) {
    if (!value) {
        return null;
    }

    /* Drop any time component first, e.g. "23-Sep-2026 12:31" -> "23-Sep-2026" */
    const datePart = String(value).trim().split(" ")[0];
    const parts = datePart.split("-");

    if (parts.length === 3 && MONTH_ABBR_TO_NUM[parts[1]]) {
        const day = parts[0].padStart(2, "0");
        const month = MONTH_ABBR_TO_NUM[parts[1]];
        const year = parts[2];

        return year + "-" + month + "-" + day;
    }

    /* Fallback for unexpected formats */
    const parsed = new Date(value);

    if (isNaN(parsed.getTime())) {
        return null;
    }

    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");

    return y + "-" + m + "-" + d;
}

function getNairobiTodayISO() {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Nairobi",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });

    return formatter.format(new Date());
}

function addDaysToISO(isoDate, days) {
    const parts = isoDate.split("-");

    const utcMs = Date.UTC(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2], 10)
    );

    const shifted = new Date(utcMs + days * 86400000);

    const y = shifted.getUTCFullYear();
    const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
    const d = String(shifted.getUTCDate()).padStart(2, "0");

    return y + "-" + m + "-" + d;
}

function computeBookingGroup(record, dateField) {
    const rawValue = getDisplayValue(record, dateField);
    const bookingISO = parseCreatorDateToISO(rawValue);

    if (!bookingISO) {
        console.warn("Could not parse booking date for grouping:", rawValue, record.ID);
        return "Upcoming";
    }

    const todayISO = getNairobiTodayISO();

    if (bookingISO < todayISO) {
        return "Past";
    }

    if (bookingISO === todayISO) {
        return "Today";
    }

    const tomorrowISO = addDaysToISO(todayISO, 1);

    if (bookingISO === tomorrowISO) {
        return "Tomorrow";
    }

    return "Upcoming";
}


/* =========================================================
   RENDER NEW BOOKINGS (SINGLE GROUPED TABLE)
========================================================= */

function renderBookingsToConfirm(records, ongoingGate, pastGate) {
    const container = document.getElementById("confirmBookingsContainer");

    document.getElementById("confirmCount").textContent =
        records.length + " record" + (records.length === 1 ? "" : "s");

    if (!records.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-title">
                    No new bookings
                </div>

                <div class="empty-message">
                    There are currently no Pending bookings.
                </div>
            </div>
        `;

        return;
    }

    const groups = {
        "Past": [],
        "Today": [],
        "Tomorrow": [],
        "Upcoming": []
    };

    records.forEach(function(record) {
        groups[record._bookingGroup].push(record);
    });

    const groupOrder = ["Past", "Today", "Tomorrow", "Upcoming"];
    const columns = CONFIG.bookingsToConfirm.columns;
    const colspan = columns.length + 1;

    let html = `
        <div class="table-wrapper">
            <table class="grouped-table">
                <thead>
                    <tr>
    `;

    columns.forEach(function(column) {
        html += `<th>${escapeHtml(column.label)}</th>`;
    });

    html += `
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
    `;

    groupOrder.forEach(function(groupName) {
        const groupRecords = groups[groupName];

        if (!groupRecords || !groupRecords.length) {
            return;
        }

            html += `
            <tr class="group-row">
                <td colspan="${colspan}">
                    <span class="group-label">${escapeHtml(groupName)} (${groupRecords.length})</span>
                </td>
            </tr>
        `;

        groupRecords.forEach(function(record) {
            html += "<tr>";

            columns.forEach(function(column) {
                const value = getDisplayValue(record, column.field);
                html += `<td>${escapeHtml(value)}</td>`;
            });

            html += `
        <td>
            ${ongoingGate
                ? '<span class="gate-message">Update Ongoing Jobs to access new bookings</span>'
                : pastGate && record._bookingGroup !== "Past"
                    ? '<span class="gate-message">Attend to Past bookings first</span>'
                    : renderBlueprintActions(record)}
        </td>
    `;

            html += "</tr>";
        });
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = html;
}


/* =========================================================
   NOT STARTED JOBS
========================================================= */

function loadNotStartedJobs() {
    const config = CONFIG.notStartedJobs;

    getReportRecords(config.reportName, config.criteria, config.pageSize)
        .then(function(records) {
            records.forEach(function(record) {
                record._blueprintName = record["Blueprint.Name"]
                    ? record["Blueprint.Name"].display_value.toLowerCase().replace(/\s+/g, "_")
                    : null;

                record._blueprintStage = record["Blueprint.Current_Stage"]
                    ? record["Blueprint.Current_Stage"].display_value
                    : null;

                record._blueprintStatus = record["Blueprint.Status"]
                    ? record["Blueprint.Status"].display_value
                    : null;
            });

            renderNotStartedJobs(records);
        })
        .catch(function(error) {
            console.error("Failed to load not started jobs:", error);
            showError("notStartedJobsContainer", "Unable to load not started jobs.");
            document.getElementById("notStartedCount").textContent = "Error";
        });
}


/* =========================================================
   RENDER NOT STARTED JOBS
========================================================= */

function renderNotStartedJobs(records) {
    const container = document.getElementById("notStartedJobsContainer");

    document.getElementById("notStartedCount").textContent =
        records.length + " record" + (records.length === 1 ? "" : "s");

    if (!records.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-title">
                    No jobs to display
                </div>

                <div class="empty-message">
                    There are currently no Approved bookings with a Not Started job stage.
                </div>
            </div>
        `;

        return;
    }

    const columns = CONFIG.notStartedJobs.columns;

    let html = `
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
    `;

    columns.forEach(function(column) {
        html += `
            <th>
                ${escapeHtml(column.label)}
            </th>
        `;
    });

    html += `
        <th>
            Actions
        </th>
    `;

    html += `
                    </tr>
                </thead>

                <tbody>
    `;

    records.forEach(function(record) {
        html += "<tr>";

        columns.forEach(function(column) {
            const value = getDisplayValue(record, column.field);

            html += `
                <td>
                    ${escapeHtml(value)}
                </td>
            `;
        });

        html += `
            <td>
                ${renderBlueprintActions(record)}
            </td>
        `;

        html += "</tr>";
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = html;
}
function loadDispatchedJobs() {
    const config = CONFIG.dispatchedJobs;

    getReportRecords(config.reportName, config.criteria, config.pageSize)
        .then(function(records) {

            records.forEach(function(record) {
                normalizeBlueprintState(record);
            });

            renderDispatchedJobs(records);
        })
        .catch(function(error) {
            console.error("Failed to load dispatched jobs:", error);
            showError("dispatchedJobsContainer", "Unable to load dispatched jobs.");
            document.getElementById("dispatchedCount").textContent = "Error";
        });
}
function renderDispatchedJobs(records) {
    const container = document.getElementById("dispatchedJobsContainer");

    document.getElementById("dispatchedCount").textContent =
        records.length + " record" + (records.length === 1 ? "" : "s");

    if (!records.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-title">
                    No dispatched jobs
                </div>

                <div class="empty-message">
                    There are currently no jobs with Dispatched stage.
                </div>
            </div>
        `;

        return;
    }

    const columns = CONFIG.dispatchedJobs.columns;

    let html = `
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
    `;

    columns.forEach(function(column) {
        html += `
            <th>
                ${escapeHtml(column.label)}
            </th>
        `;
    });

    html += `
        <th>
            Actions
        </th>
    </tr>
    </thead>
    <tbody>
    `;

    records.forEach(function(record) {

        html += `
            <tr>
        `;

        columns.forEach(function(column) {
            const value = getDisplayValue(record, column.field);

            html += `
                <td>
                    ${escapeHtml(value)}
                </td>
            `;
        });

        html += `
            <td>
                ${renderBlueprintActions(record)}
            </td>
        </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    </div>
    `;

    container.innerHTML = html;
}


/* =========================================================
   RENDER BLUEPRINT ACTIONS
========================================================= */

function renderBlueprintActions(record) {
    const blueprintName = record._blueprintName;
    const blueprintStage = record._blueprintStage;

    if (!blueprintName) {
        return `
            <span class="no-actions">
                Blueprint unavailable
            </span>
        `;
    }

    if (!blueprintStage) {
        return `
            <span class="no-actions">
                Stage unavailable
            </span>
        `;
    }

    const blueprintConfig = BLUEPRINT_CONFIG[blueprintName];

    if (!blueprintConfig) {
        return `
            <span class="no-actions">
                No actions configured
            </span>
        `;
    }

    const transitions = getBlueprintTransitions(blueprintConfig, blueprintStage);

    if (!transitions || transitions.length === 0) {
        return `
            <span class="no-actions">
                No actions
            </span>
        `;
    }

    let buttonsHtml = "";

    transitions.forEach(function(transition) {
        buttonsHtml += `
            <button
                type="button"
                class="blueprint-button"
                onclick="handleBlueprintTransition('${escapeHtml(record.ID)}', '${escapeHtml(transition.linkName)}', '${escapeHtml(blueprintName)}')">

                ${escapeHtml(transition.label)}

            </button>
        `;
    });

    return `<div class="action-buttons">${buttonsHtml}</div>`;
}

function getBlueprintTransitions(blueprintConfig, blueprintStage) {

    const commonTransitions =
        blueprintConfig.commonTransitions || [];

    const stageTransitions =
        blueprintConfig[blueprintStage] || [];

    return stageTransitions.concat(commonTransitions);
}



/* =========================================================
   BLUEPRINT TRANSITION CLICK
========================================================= */

function handleBlueprintTransition(recordId, transitionName, blueprintName) {
    const found = findTransitionConfiguration(
        blueprintName,
        transitionName
    );

    if (!found) {
        console.error(
            "Transition configuration not found:",
            blueprintName,
            transitionName
        );

        alert("The configuration for this transition could not be found.");
        return;
    }

    const transitionConfig = found.transition;
    const apiKey = BLUEPRINT_API_MAP[blueprintName];

    if (!apiKey) {
        console.error(
            "No API mapping found for blueprint:",
            blueprintName
        );

        alert("No API configuration found for this blueprint.");
        return;
    }

    if (transitionConfig.type === "choice") {
        renderChoiceModal(
            recordId,
            transitionConfig,
            apiKey,
            blueprintName
        );

        return;
    }

    if (transitionConfig.duringAction) {
        renderDuringActionModal(
            recordId,
            transitionConfig,
            apiKey,
            blueprintName
        );

        return;
    }

    executeTransitionOnly(
        apiKey,
        recordId,
        transitionConfig,
        blueprintName
    );
}


/* =========================================================
   FIND TRANSITION CONFIGURATION
========================================================= */

function findTransitionConfiguration(blueprintName, transitionName) {
    const blueprint = BLUEPRINT_CONFIG[blueprintName];

    if (!blueprint) {
        return null;
    }

    let found = null;

    Object.keys(blueprint).forEach(function(stageName) {
        const transitions = blueprint[stageName];

        if (!transitions) {
            return;
        }

        transitions.forEach(function(transition) {

            if (transition.linkName === transitionName) {
                found = {
                    transition: transition,
                    blueprintName: blueprintName
                };
            }

            if (transition.type === "choice" && transition.choices) {

                transition.choices.forEach(function(choice) {

                    if (choice.linkName === transitionName) {
                        found = {
                            transition: choice,
                            blueprintName: blueprintName
                        };
                    }

                });

            }

        });
    });

    return found;
}

/* =========================================================
   EXECUTE TRANSITION (NO DURING ACTION)
========================================================= */

function executeTransitionOnly(
    apiKey,
    recordId,
    transition,
    blueprintName
) {
    showLoadingOverlay("Executing transition...");

    executeBlueprintTransition(
        apiKey,
        recordId,
        transition.linkName,
        blueprintName
    )
        .then(function() {
        hideLoadingOverlay();
        showToast("Transition completed successfully.", "success");

        if (transition.afterAction === "openPrepSheet") {
            openBookingPrepSheet(recordId);
        }
        else if (transition.afterAction === "openPrepSheetForNewRecord") {
            openPrepSheetForNewRecord(recordId, transition);
        }
        else if (transition.afterAction === "openPlanning") {
            loadOngoingJobs();
            loadBookingsToConfirm();
            loadNotStartedJobs();
            loadDispatchedJobs();
            openLabourPlanning(recordId);
        }
        else {
            loadOngoingJobs();
            loadBookingsToConfirm();
            loadNotStartedJobs();
            loadDispatchedJobs();
        }
    })
    .catch(function(error) {
        hideLoadingOverlay();
        console.error("Blueprint transition failed:", error);
        showToast(error.message || "The transition could not be completed. Please try again.", "error");
    });
}


/* =========================================================
   CHOICE MODAL (GROUPED TRANSITIONS)
========================================================= */

function renderChoiceModal(recordId, transitionGroup, apiKey, blueprintName) {
    const choices = transitionGroup.choices || [];
    let choicesHtml = "";

    choices.forEach(function(choice, index) {
        choicesHtml += `
            <label class="choice-option">
                <input
                    type="radio"
                    name="continuingChoice"
                    value="${escapeHtml(choice.linkName)}"
                    ${index === 0 ? "checked" : ""}>

                ${escapeHtml(choice.label)}
            </label>
        `;
    });

    const modal = document.createElement("div");
    modal.className = "during-action-modal";
    modal.id = "choiceModal";

    modal.innerHTML = `
        <div class="during-action-overlay">
            <div class="during-action-dialog">

                <div class="during-action-header">
                    <div>
                        <h2>${escapeHtml(transitionGroup.label)}</h2>
                        <div class="during-action-subtitle">Select an option to continue</div>
                    </div>

                    <button type="button" class="during-action-close" onclick="closeChoiceModal()">&times;</button>
                </div>

                <div class="during-action-body">
                    ${choicesHtml}
                </div>

                <div class="during-action-footer">
                    <button type="button" class="during-action-cancel" onclick="closeChoiceModal()">Cancel</button>
                    <button type="button" class="during-action-submit" onclick="submitChoiceSelection()">Continue</button>
                </div>

            </div>
        </div>
    `;

    modal.dataset.recordId = recordId;
    modal.dataset.choices = JSON.stringify(choices);
    modal.dataset.apiKey = apiKey;
    modal.dataset.blueprintName = blueprintName;

    document.body.appendChild(modal);
}


function closeChoiceModal() {
    const modal = document.getElementById("choiceModal");

    if (modal) {
        modal.remove();
    }
}


function submitChoiceSelection() {
    const modal = document.getElementById("choiceModal");

    if (!modal) {
        return;
    }

    const recordId = modal.dataset.recordId;
    const apiKey = modal.dataset.apiKey;
    const choices = JSON.parse(modal.dataset.choices || "[]");
    const selectedInput = modal.querySelector('input[name="continuingChoice"]:checked');
    const blueprintName = modal.dataset.blueprintName;

    if (!selectedInput) {
        alert("Please select an option.");
        return;
    }

    const selectedChoice = choices.find(function(choice) {
        return choice.linkName === selectedInput.value;
    });

    if (!selectedChoice) {
        alert("The selected option could not be found.");
        return;
    }

    closeChoiceModal();

    if (selectedChoice.duringAction) {
        renderDuringActionModal(recordId, selectedChoice, apiKey, blueprintName);
    }
    else {
        executeTransitionOnly(apiKey, recordId, selectedChoice, blueprintName);
    }
}


/* =========================================================
   RENDER DURING ACTION MODAL
========================================================= */

function renderDuringActionModal(recordId, transition, apiKey, blueprintName) {
    const duringAction = transition.duringAction;

    if (!duringAction) {
        return;
    }

    if (duringAction.type !== "updateFields") {
        alert("This type of During action is not yet supported.");
        return;
    }

    const hasSubform = (duringAction.fields || []).some(function(field) {
        return field.type === "subform";
    });

    if (!hasSubform) {
        buildDuringActionModal(recordId, transition, apiKey, blueprintName, {});
        return;
    }

    showLoadingOverlay("Loading planned labour...");

    prepareSubformContext(recordId, duringAction)
        .then(function(context) {
            hideLoadingOverlay();
            buildDuringActionModal(recordId, transition, apiKey, blueprintName, context);
        })
        .catch(function(error) {
            hideLoadingOverlay();
            console.error("Failed to load subform context:", error);
            showToast("Unable to load planned labour details.", "error");
        });
}


/* =========================================================
   PREPARE SUBFORM CONTEXT
========================================================= */

function prepareSubformContext(recordId, duringAction) {
    const reportName = duringAction.reportName;

    const subformFields = (duringAction.fields || []).filter(function(field) {
        return field.type === "subform";
    });

    const topLevelLookupFields = (duringAction.fields || []).filter(function(field) {
        return field.type === "lookup" && field.lookupReport;
    });

    return getRecordById(reportName, recordId)
        .then(function(record) {
            if (!record) {
                throw new Error("Could not retrieve the booking record.");
            }

            const lookupReports = [];

            subformFields.forEach(function(subform) {
                (subform.columns || []).forEach(function(column) {
                    if (column.type === "lookup" && column.lookupReport &&
                        !lookupReports.includes(column.lookupReport)) {
                        lookupReports.push(column.lookupReport);
                    }
                });
            });

            const lookupOptions = {};
            const lookupOptionsByField = {};

            const subformLookupPromise = Promise.all(
                lookupReports.map(function(lookupReport) {
                    let lookupConfig = {};

                    subformFields.forEach(function(subform) {
                        (subform.columns || []).forEach(function(column) {
                            if (column.type === "lookup" && column.lookupReport === lookupReport) {
                                lookupConfig = column;
                            }
                        });
                    });

                    return getAllReportRecords(lookupReport, lookupConfig.criteria)
                        .then(function(records) {
                            const valueField = lookupConfig.valueField || "ID";
                            const displayField = lookupConfig.displayField || "Name";

                            lookupOptions[lookupReport] = (records || [])
                                .map(function(record) {
                                    const value = record[valueField] || record.ID || record.id || "";
                                    const label = getDisplayValue(record, displayField).trim();

                                    return {value:String(value), label:label, record:record};
                                })
                                .filter(function(option) {
                                    return option.value && option.label;
                                });

                            return lookupOptions[lookupReport];
                        });
                })
            );

            const topLevelLookupPromise = Promise.all(
                topLevelLookupFields.map(function(field) {
                    return getAllReportRecords(field.lookupReport, field.criteria)
                        .then(function(records) {
                            const valueField = field.valueField || "ID";
                            const displayField = field.displayField || "Name";

                            lookupOptionsByField[field.field] = (records || [])
                                .map(function(record) {
                                    const value = record[valueField] || record.ID || record.id || "";
                                    const label = getDisplayValue(record, displayField).trim();

                                    return {value:String(value), label:label, record:record};
                                })
                                .filter(function(option) {
                                    return option.value && option.label;
                                });

                            return lookupOptionsByField[field.field];
                        });
                })
            );

            return Promise.all([subformLookupPromise, topLevelLookupPromise])
                .then(function() {
                    const teamMemberOptions = lookupOptions["All_Team_Members"] || [];
                    const teamMembersByName = {};

                    teamMemberOptions.forEach(function(option) {
                        teamMembersByName[normaliseLookupName(option.label)] = option;
                    });

                    const parsedSubforms = {};

                    subformFields.forEach(function(subform) {
                        const rawRows = record[subform.field];
                        const rows = Array.isArray(rawRows) ? rawRows : [];

                        parsedSubforms[subform.field] = rows.map(function(row) {
                            const parsed = parseAssignedLabourRow(row);

                            const lookupMatch = teamMembersByName[normaliseLookupName(parsed.name)];

                            return {
                                name: parsed.name,
                                role: parsed.role,
                                subformRowId: parsed.subformRowId,
                                lookupId: lookupMatch ? lookupMatch.value : ""
                            };
                        });
                    });

                    return {
                        record: record,
                        lookupOptions: lookupOptions,
                        lookupOptionsByField: lookupOptionsByField,
                        parsedSubforms: parsedSubforms,
                        teamMembersByName: teamMembersByName
                    };
                });
        });
}


/* =========================================================
   PARSE ASSIGNED LABOUR SUBFORM ROW
========================================================= */

function parseAssignedLabourRow(row) {
    const rawDisplay = extractSubformValue(row).trim();

    let role = extractSubformValue(row["Role"]).trim();

    if (!role) {
        const lastComma = rawDisplay.lastIndexOf(",");

        if (lastComma !== -1) {
            role = rawDisplay.slice(lastComma + 1).trim();
        }
    }

    let name = rawDisplay;

    if (role) {
        const lastComma = rawDisplay.lastIndexOf(",");

        if (lastComma !== -1) {
            name = rawDisplay.slice(0, lastComma).trim();
        }
    }

    return {
        name: name,
        role: role || "Mover",
        subformRowId: row.ID || row.id || ""
    };
}


/* =========================================================
   GENERIC SUBFORM VALUE EXTRACTION
========================================================= */

function extractSubformValue(value) {
    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value === "object") {
        return value.display_value || value.name || value.value || "";
    }

    return String(value);
}


/* =========================================================
   NORMALIZE LOOKUP NAME
========================================================= */

function normaliseLookupName(name) {
    return String(name || "").replace(/\s+/g, " ").trim().toLowerCase();
}


/* =========================================================
   BUILD DURING ACTION MODAL
========================================================= */

function buildDuringActionModal(recordId, transition, apiKey, blueprintName, context) {
    const duringAction = transition.duringAction;
    const fields = duringAction.fields || [];
    const hasSubform = fields.some(function(field) {
        return field.type === "subform";
    });

    let fieldsHtml = "";

    fields.forEach(function(field) {
        fieldsHtml += renderDuringActionField(field, context);
    });

    const modal = document.createElement("div");
    modal.className = "during-action-modal";
    modal.id = "duringActionModal";

    modal.innerHTML = `
        <div class="during-action-overlay">
            <div class="during-action-dialog${hasSubform ? " has-subform" : ""}">

                <div class="during-action-header">
                    <div>
                        <h2>${escapeHtml(transition.label)}</h2>
                        <div class="during-action-subtitle">${escapeHtml(duringAction.formName)}</div>
                    </div>

                    <button type="button" class="during-action-close" onclick="closeDuringActionModal()">&times;</button>
                </div>

                <div class="during-action-body">
                    ${fieldsHtml}
                </div>

                <div class="during-action-footer">
                    <button type="button" class="during-action-cancel" onclick="closeDuringActionModal()">Cancel</button>
                    <button type="button" class="during-action-submit" onclick="submitDuringAction()">Continue</button>
                </div>

            </div>
        </div>
    `;

    modal.dataset.recordId = recordId;
    modal.dataset.blueprintName = blueprintName;
    modal.dataset.transitionName = transition.linkName;
    modal.dataset.reportName = duringAction.reportName || "All_Jobs";
    modal.dataset.apiKey = apiKey;
    modal.dataset.afterAction = transition.afterAction || "";
    activeDuringActionContext = { recordId: recordId, transition: transition, apiKey: apiKey, blueprintName: blueprintName };

    document.body.appendChild(modal);

    updateConditionalDuringActionFields(modal);

    const abruptMoveField = modal.querySelector('[name="Abrupt_Move"]');

    if (abruptMoveField) {
        abruptMoveField.addEventListener("change", function() {
            updateConditionalDuringActionFields(modal);
        });
    }
}


/* =========================================================
   RENDER DURING ACTION FIELD
========================================================= */

function renderDuringActionField(field, context) {
    if (field.type === "subform") {
        return renderSubformField(field, context);
    }

   const showWhen = field.showWhen;
const conditionalAttributes = showWhen
    ? `data-show-when-field="${escapeHtml(showWhen.field)}" data-show-when-value="${escapeHtml(showWhen.equals)}"`
    : "";

let html = `
    <div
        class="during-action-field${field.layout === "half" ? " during-action-field-half" : ""}"
        data-field="${escapeHtml(field.field)}"
        ${conditionalAttributes}>

        <label>
            ${escapeHtml(field.label)}
            ${field.required ? `<span class="required">*</span>` : ""}
        </label>
`;

    if (field.type === "select") {
        html += `
            <select
                name="${escapeHtml(field.field)}"
                class="during-action-input">
                <option value="">Select...</option>
        `;

        (field.options || []).forEach(function(option) {
            const selected = option === field.defaultValue ? "selected" : "";

            html += `
                <option value="${escapeHtml(option)}" ${selected}>
                    ${escapeHtml(option)}
                </option>
            `;
        });

        html += `
            </select>
        `;
    }
    else if (field.type === "number") {
        html += `
            <input
                type="number"
                name="${escapeHtml(field.field)}"
                class="during-action-input"
                step="any">
        `;
    }
    else if (field.type === "date") {
        html += `
            <input
                type="date"
                name="${escapeHtml(field.field)}"
                class="during-action-input">
        `;
    }
    else if (field.type === "datetime") {
        html += `
            <input
                type="datetime-local"
                name="${escapeHtml(field.field)}"
                class="during-action-input">
        `;
    }
    else if (field.type === "lookup") {
        const options = (context.lookupOptionsByField && context.lookupOptionsByField[field.field]) || [];

        html += `
            <div class="lookup-combo ${field.layout === "half" ? "lookup-half" : ""}">
                <input type="text" class="lookup-search-input during-action-lookup" autocomplete="off"
                    placeholder="Search ${escapeHtml(field.label)}..."
                    data-field="${escapeHtml(field.field)}"
                    data-options='${escapeHtml(JSON.stringify(options))}'
                    oninput="handleLookupSearchInput(this)"
                    onfocus="handleLookupSearchInput(this)"
                    onblur="hideLookupDropdownDelayed(this)"
                    onkeydown="if(event.key==='Escape'){this.blur();}">
                <input type="hidden" class="during-action-lookup-value" name="${escapeHtml(field.field)}">
            </div>
        `;
    }
    else {
        html += `
            <input
                type="text"
                name="${escapeHtml(field.field)}"
                class="during-action-input">
        `;
    }

    html += `
        </div>
    `;

    return html;
}


/* =========================================================
   RENDER SUBFORM FIELD
========================================================= */

function renderSubformField(field, context) {
    const rows = (context.parsedSubforms && context.parsedSubforms[field.field]) || [];
    const columns = field.columns || [];

    let rowsHtml = "";

    rows.forEach(function(row) {
        rowsHtml += renderSubformRow(columns, row, context.lookupOptions);
    });

    let headerHtml = "";

    columns.forEach(function(column) {
        headerHtml += `<th>${escapeHtml(column.label)}</th>`;
    });

    return `
        <div class="during-action-field">
            <label>${escapeHtml(field.label)}</label>

            <div class="subform-wrapper"
                data-field="${escapeHtml(field.field)}"
                data-columns='${escapeHtml(JSON.stringify(columns))}'
                data-lookup-options='${escapeHtml(JSON.stringify(context.lookupOptions || {}))}'>

                <table class="subform-table">
                    <thead>
                        <tr>${headerHtml}<th></th></tr>
                    </thead>
                    <tbody class="subform-body">
                        ${rowsHtml}
                    </tbody>
                </table>

                <button type="button" class="subform-add-button" onclick="addSubformRow(this)">+ Add member</button>
            </div>
        </div>
    `;
}


/* =========================================================
   RENDER SUBFORM ROW
========================================================= */

function renderSubformRow(columns, row, lookupOptions) {
    let cellsHtml = "";

    columns.forEach(function(column) {
       if (column.type === "lookup") {
    const options = (lookupOptions && lookupOptions[column.lookupReport]) || [];
    let currentId = "";
    let currentLabel = "";

    if (row && row.lookupId) {
        currentId = String(row.lookupId);
    }

    if (!currentId && row && row.name) {
        const normalizedName = normaliseLookupName(row.name);
        const nameMatch = options.find(function(option) {
            return normaliseLookupName(option.label) === normalizedName;
        });

        if (nameMatch) {
            currentId = String(nameMatch.value);
        }
    }

    if (currentId) {
        const matched = options.find(function(option) {
            return String(option.value) === currentId;
        });

        currentLabel = matched ? matched.label : (row && row.name ? row.name : "");
    }
    else if (row && row.name) {
        currentLabel = row.name;
    }

    cellsHtml += `
        <td>
            <div class="lookup-combo">

                <input
                    type="text"
                    class="lookup-search-input"
                    autocomplete="off"
                    placeholder="Search..."
                    value="${escapeHtml(currentLabel)}"
                    data-options='${escapeHtml(JSON.stringify(options))}'
                    oninput="handleLookupSearchInput(this)"
                    onfocus="handleLookupSearchInput(this)"
                    onblur="hideLookupDropdownDelayed(this)"
                    onkeydown="if(event.key==='Escape'){this.blur();}">

                <input
                    type="hidden"
                    class="subform-cell-input"
                    data-column="${escapeHtml(column.field)}"
                    value="${escapeHtml(currentId)}">

            </div>
        </td>
    `;
}
        else if (column.type === "select") {
            let currentValue = "";

            if (row) {
                currentValue = row.role || getDisplayValue(row, column.field) || "";
            }

            let optionsHtml = `<option value="">Select...</option>`;

            (column.options || []).forEach(function(option) {
                const selected = option === currentValue ? "selected" : "";
                optionsHtml += `<option value="${escapeHtml(option)}" ${selected}>${escapeHtml(option)}</option>`;
            });

            cellsHtml += `
                <td>
                    <select class="subform-cell-input" data-column="${escapeHtml(column.field)}">
                        ${optionsHtml}
                    </select>
                </td>
            `;
        }
    });

    cellsHtml += `
        <td>
            <button type="button" class="subform-remove-button" onclick="this.closest('tr').remove()">&times;</button>
        </td>
    `;

    return `<tr class="subform-row">${cellsHtml}</tr>`;
}


/* =========================================================
   ADD SUBFORM ROW
========================================================= */

function addSubformRow(button) {
    const wrapper = button.closest(".subform-wrapper");
    const columns = JSON.parse(wrapper.dataset.columns || "[]");
    const lookupOptions = JSON.parse(wrapper.dataset.lookupOptions || "{}");
    const tbody = wrapper.querySelector(".subform-body");

    tbody.insertAdjacentHTML("beforeend", renderSubformRow(columns, null, lookupOptions));
}
/* =========================================================
   SEARCHABLE LOOKUP COMBOBOX (PORTAL-BASED)
   ---------------------------------------------------------
   Rendered outside the table/modal DOM tree to avoid being
   clipped by ancestor overflow rules (.subform-table,
   .during-action-body, etc). Positioned via getBoundingClientRect
   against whichever search input is currently active.
========================================================= */

let activeLookupSearchInput = null;

function getLookupPortal() {
    let portal = document.getElementById("lookupDropdownPortal");

    if (!portal) {
        portal = document.createElement("div");
        portal.id = "lookupDropdownPortal";
        portal.className = "lookup-dropdown-portal";
        document.body.appendChild(portal);
    }

    return portal;
}

function positionLookupPortal(inputEl) {
    const portal = getLookupPortal();
    const rect = inputEl.getBoundingClientRect();

    portal.style.position = "fixed";
    portal.style.top = (rect.bottom + 4) + "px";
    portal.style.left = rect.left + "px";
    portal.style.width = rect.width + "px";
}

function handleLookupSearchInput(inputEl) {
    activeLookupSearchInput = inputEl;

    const wrapper = inputEl.closest(".lookup-combo");
    if (!wrapper) return;

    const hiddenInput = wrapper.querySelector(".subform-cell-input") ||
        wrapper.querySelector(".during-action-lookup-value");

    if (!hiddenInput) return;

    const options = JSON.parse(inputEl.dataset.options || "[]");
    const query = inputEl.value.trim().toLowerCase();

    hiddenInput.value = "";

    const filtered = query
        ? options.filter(function(option) {
            return option.label.toLowerCase().includes(query);
        })
        : options;

    positionLookupPortal(inputEl);
    renderLookupPortalList(filtered);
    showLookupPortal();
}

function renderLookupPortalList(options) {
    const portal = getLookupPortal();

    if (!options.length) {
        portal.innerHTML = `<div class="lookup-option-empty">No matches</div>`;
        return;
    }

    let html = "";

    options.forEach(function(option) {
        html += `
            <div
                class="lookup-option"
                data-value="${escapeHtml(option.value)}"
                data-label="${escapeHtml(option.label)}"
                onmousedown="selectLookupOption(this)">

                ${escapeHtml(option.label)}

            </div>
        `;
    });

    portal.innerHTML = html;
}

function selectLookupOption(optionEl) {
    if (!activeLookupSearchInput) {
        return;
    }

   const wrapper = activeLookupSearchInput.closest(".lookup-combo");
   const hiddenInput = wrapper.querySelector(".subform-cell-input") ||
    wrapper.querySelector(".during-action-lookup-value");
if (!hiddenInput) return;

    hiddenInput.value = optionEl.dataset.value;
    activeLookupSearchInput.value = optionEl.dataset.label;

    hideLookupPortal();
}

function showLookupPortal() {
    getLookupPortal().classList.add("open");
}

function hideLookupPortal() {
    getLookupPortal().classList.remove("open");
    activeLookupSearchInput = null;
}

function hideLookupDropdownDelayed(inputEl) {
    /* mousedown on an option fires before this blur, so the
       click still registers; the timeout is just a safety net. */
    setTimeout(function() {
        hideLookupPortal();
    }, 150);
}
/* =========================================================
   CLOSE DURING ACTION MODAL
========================================================= */

function closeDuringActionModal() {
    const modal = document.getElementById("duringActionModal");

    if (modal) {
        modal.remove();
    }
     hideLookupPortal();
}
function collectDuringActionData(modal, duringAction) {
    const data = {};
    (duringAction.fields || []).forEach(function(field) {
        if (field.type === "subform") return;
        const input = modal.querySelector(`[name="${field.field}"]`);
        if (!input) return;
        let value = input.value;
        if (input.type === "date" && value) value = formatCreatorDate(value);
        else if (input.type === "datetime-local" && value) {
            const date = new Date(value);
            const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            value = String(date.getDate()).padStart(2,"0") + "-" + months[date.getMonth()] + "-" + date.getFullYear() + " " + String(date.getHours()).padStart(2,"0") + ":" + String(date.getMinutes()).padStart(2,"0") + ":00";
        }
        data[field.field] = value;
    });
    (duringAction.fields || []).filter(function(field) { return field.type === "lookup"; }).forEach(function(field) {
        const input = modal.querySelector(`.during-action-lookup-value[name="${field.field}"]`);
        if (input) data[field.field] = input.value;
    });
    (duringAction.fields || []).filter(function(field) { return field.type === "subform"; }).forEach(function(field) {
        const wrapper = modal.querySelector(`.subform-wrapper[data-field="${field.field}"]`);
        const rows = [];
        if (wrapper) {
            wrapper.querySelectorAll(".subform-row").forEach(function(tr) {
                const rowData = {};
                let hasValue = false;
                tr.querySelectorAll(".subform-cell-input").forEach(function(input) {
                    if (input.value) hasValue = true;
                    rowData[input.dataset.column] = input.value;
                });
                if (hasValue) rows.push(rowData);
            });
        }
        data[field.field] = rows;
    });
    return data;
}
function validateDuringActionData(modal, duringAction, data) {
    for (const field of duringAction.fields || []) {
        const value = data[field.field];
        let isVisible = true;

        if (field.showWhen) {
            const controllingValue = data[field.showWhen.field];
            isVisible = controllingValue === field.showWhen.equals;
        }

        if (field.required && isVisible && (value === undefined || value === null || String(value).trim() === "")) return `Please enter ${field.label}.`;

        if (field.requiredWhen && data[field.requiredWhen.field] === field.requiredWhen.equals && (value === undefined || value === null || String(value).trim() === "")) return `Please enter ${field.label}.`;
    }
    return null;
}
function applyDuringActionRules(data, rules) {
    if (!rules) return;
    if (rules.addLookupToSubform) {
        const rule = rules.addLookupToSubform;
        const sourceValue = data[rule.sourceField];
        if (!sourceValue) return;
        const rows = data[rule.targetSubform] || [];
        const exists = rows.some(function(row) { return String(row[rule.valueColumn]) === String(sourceValue); });
        if (!exists) {
            const row = {};
            row[rule.valueColumn] = sourceValue;
            Object.assign(row, rule.extraValues || {});
            rows.push(row);
        }
        data[rule.targetSubform] = rows;
    }
}

/* =========================================================
   SUBMIT DURING ACTION
========================================================= */

function submitDuringAction() {
    const modal = document.getElementById("duringActionModal");
    if (!modal || !activeDuringActionContext) return;

    const context = activeDuringActionContext;
    const recordId = context.recordId;
    const transition = context.transition;
    const duringAction = transition.duringAction;
    const apiKey = context.apiKey;
    const blueprintName = context.blueprintName;
    const reportName = duringAction.reportName || "All_Jobs";
    const afterAction = transition.afterAction || "";

    const data = collectDuringActionData(modal, duringAction);
    const validationError = validateDuringActionData(modal, duringAction, data);

    if (validationError) {
        showToast(validationError, "error");
        return;
    }

    applyDuringActionRules(data, duringAction.rules);

    closeDuringActionModal();
    showLoadingOverlay("Updating record...");

    updateCreatorRecord(reportName, recordId, data)
        .then(function() { return executeBlueprintTransition(apiKey, recordId, transition.linkName, blueprintName); })
        .then(function() {
            hideLoadingOverlay();
            activeDuringActionContext = null;
            showToast("Transition completed successfully.", "success");

            if (afterAction === "openPrepSheet") openBookingPrepSheet(recordId);
            else if (afterAction === "openPlanning") openPlanning();
            else if (afterAction === "openPrepSheetForNewRecord") openPrepSheetForNewRecord(recordId);
            else {
                loadOngoingJobs();
                loadBookingsToConfirm();
                loadNotStartedJobs();
                loadDispatchedJobs();
            }
        })
        .catch(function(error) {
            hideLoadingOverlay();
            console.error("Blueprint transition failed:", error);
            showToast(error.message || "The transition could not be completed. Please try again.", "error");
        });
}

/* =========================================================
   GET DISPLAY VALUE
========================================================= */

function getDisplayValue(record, fieldName) {
    const value = record[fieldName];

    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value === "object") {
        if (value.display_value !== undefined) {
            return value.display_value;
        }

        if (value.name !== undefined) {
            return value.name;
        }

        if (value.value !== undefined) {
            return value.value;
        }

        return JSON.stringify(value);
    }

    return String(value);
}


/* =========================================================
   HTML ESCAPING
========================================================= */

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   ERROR DISPLAY
========================================================= */

function showError(containerId, message) {
    const container = document.getElementById(containerId);

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="error-state">
            ${escapeHtml(message)}
        </div>
    `;
}


/* =========================================================
   OPEN BOOKING PREP SHEET
========================================================= */

function openBookingPrepSheet(bookingId) {

    const url =
        "#Page:Relocation_Prep_Sheet?recordId=" +
        encodeURIComponent(bookingId);

    const params = {
        action: "open",
        url: url,
        window: "same"
    };

    ZOHO.CREATOR.UTIL.navigateParentURL(params);
}

function openPrepSheetForNewRecord(recordId, transition) {
    showLoadingOverlay("Looking up new booking...");

    getReportRecords(transition.lookupReport, "(ID == " + recordId + ")", 1)
        .then(function(records) {
            hideLoadingOverlay();

            const record = records[0];

            if (!record) {
                showToast("Transition completed, but the new booking could not be located.", "error");
                loadOngoingJobs();
                loadBookingsToConfirm();
                loadNotStartedJobs();
                loadDispatchedJobs();
                return;
            }

            const newBookingId = getDisplayValue(record, transition.lookupField);

            if (!newBookingId) {
                showToast("Transition completed, but the new booking could not be located.", "error");
                loadOngoingJobs();
                loadBookingsToConfirm();
                loadNotStartedJobs();
                loadDispatchedJobs();
                return;
            }

            openBookingPrepSheet(newBookingId);
        })
        .catch(function(error) {
            hideLoadingOverlay();
            console.error("Failed to look up new booking:", error);
            showToast("Transition completed, but the new booking could not be located.", "error");
        });
}
/* =========================================================
   OPEN LABOUR PLANNING (APPROVAL REDIRECT)
========================================================= */

function openLabourPlanning(recordId) {
    showLoadingOverlay("Opening Planning...");

    getReportRecords(CONFIG.bookingsToConfirm.reportName, "(ID == " + recordId + ")", 1)
        .then(function(records) {
            hideLoadingOverlay();

            const record = records[0];

            if (!record) {
                showToast("Approved, but the booking could not be located for Planning.", "error");
                loadOngoingJobs();
                loadBookingsToConfirm();
                loadNotStartedJobs();
                loadDispatchedJobs();
                return;
            }

            const rawDate = getDisplayValue(record, CONFIG.bookingsToConfirm.dateField);
            const moveDateISO = parseCreatorDateToISO(rawDate);

            if (!moveDateISO) {
                showToast("Approved, but the move date could not be determined.", "error");
                loadOngoingJobs();
                loadBookingsToConfirm();
                loadNotStartedJobs();
                loadDispatchedJobs();
                return;
            }

            const url =
                "#Page:Labour_Allocation_View?source=bookingApproval&bookingId=" +
                encodeURIComponent(recordId) +
                "&moveDate=" +
                encodeURIComponent(moveDateISO);

            ZOHO.CREATOR.UTIL.navigateParentURL({
                action: "open",
                url: url,
                window: "new"
            });
        })
        .catch(function(error) {
            hideLoadingOverlay();
            console.error("Failed to load booking for Planning redirect:", error);
            showToast("Approved, but could not open Planning. Please try again.", "error");
        });
}

/* =========================================================
   TOAST NOTIFICATIONS
========================================================= */

function showToast(message, type) {
    type = type || "info";

    let container = document.getElementById("toastContainer");

    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "toast toast-" + type;
    toast.textContent = message;

    container.appendChild(toast);

    requestAnimationFrame(function() {
        toast.classList.add("toast-visible");
    });

    setTimeout(function() {
        toast.classList.remove("toast-visible");
        setTimeout(function() {
            toast.remove();
        }, 300);
    }, 3500);
}


/* =========================================================
   LOADING OVERLAY
========================================================= */

function showLoadingOverlay(message) {
    let overlay = document.getElementById("loadingOverlay");

    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "loadingOverlay";
        overlay.className = "loading-overlay";

        overlay.innerHTML = `
            <div class="loading-overlay-content">
                <div class="loading-spinner"></div>
                <div class="loading-overlay-text" id="loadingOverlayText"></div>
            </div>
        `;

        document.body.appendChild(overlay);
    }

    document.getElementById("loadingOverlayText").textContent = message || "Updating...";
    overlay.classList.add("visible");
}

function hideLoadingOverlay() {
    const overlay = document.getElementById("loadingOverlay");

    if (overlay) {
        overlay.classList.remove("visible");
    }
}


/* =========================================================
   FORMAT DATE FOR ZOHO CREATOR
========================================================= */

function formatCreatorDate(value) {

    if (!value) {
        return "";
    }

    const parts = value.split("-");

    if (parts.length !== 3) {
        return value;
    }

    const year = parts[0];
    const month = parseInt(parts[1], 10);
    const day = parts[2];

    const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
    ];

    if (month < 1 || month > 12) {
        return value;
    }

    return day + "-" + months[month - 1] + "-" + year;
}
/* =========================================================
   GENERIC INFORMATION MODAL
========================================================= */

function showInfoModal(title, message) {
    if (document.getElementById("infoModal")) {
        return;
    }

    const modal = document.createElement("div");
    modal.className = "during-action-modal";
    modal.id = "infoModal";

    modal.innerHTML = `
        <div class="during-action-overlay">
            <div class="during-action-dialog info-modal-dialog">

                <div class="during-action-header">
                    <div>
                        <h2>${escapeHtml(title)}</h2>
                    </div>

                    <button
                        type="button"
                        class="during-action-close"
                        onclick="closeInfoModal()">
                        &times;
                    </button>
                </div>

                <div class="during-action-body">
                    <div class="info-modal-message">
                        ${escapeHtml(message)}
                    </div>
                </div>

                <div class="during-action-footer">
                    <button
                        type="button"
                        class="during-action-submit"
                        onclick="closeInfoModal()">
                        OK
                    </button>
                </div>

            </div>
        </div>
    `;

    document.body.appendChild(modal);
}


function closeInfoModal() {
    const modal = document.getElementById("infoModal");

    if (modal) {
        modal.remove();
    }
}
function updateConditionalDuringActionFields(modal) {
    modal.querySelectorAll("[data-show-when-field]").forEach(function(wrapper) {
        const controllingFieldName = wrapper.dataset.showWhenField;
        const expectedValue = wrapper.dataset.showWhenValue;
        const controllingField = modal.querySelector(`[name="${controllingFieldName}"]`);
        const shouldShow = controllingField && controllingField.value === expectedValue;

        wrapper.style.display = shouldShow ? "" : "none";

        if (!shouldShow) {
            wrapper.querySelectorAll("select, input:not([type='hidden']), textarea").forEach(function(input) {
                input.value = "";
            });
        }
    });
}