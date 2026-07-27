INTENT_ADD = "add_plugin"
INTENT_LIST = "list_plugins"
INTENT_PATCH = "patch_visualization"
INTENT_OOS = "out_of_scope"

INTENTS: dict[str, list[str]] = {
    INTENT_ADD: [
        "add the plugin named X with argument value 123",
        "add the my_data_source plugin for id 12 and code 34",
        "add the my_data_source plugin for station 12345 with args arg_1 x, arg_y 3, arg_z 7",
        "put the my_data_source plugin on the dashboard for station 3222",
        "add a tile using the rainfall plugin for gauge 55",
        "add a visualization to my dashboard",
        "add the same plugin again for a different value",
        "add the usgs_water_services plugin for site 09380000",
        "add the cw3e_surface_meterology plugin",
        "add the hydroserver_plot plugin for datastream 5",
        "add the cnrfc_daily_briefing tile",
        "add the cimss_integrated_microwave_animations plugin",
    ],
    INTENT_LIST: [
        "what plugins are available?",
        "what custom plugins are available?",
        "list the available visualizations",
        "what plugins can I add to my dashboard?",
        "show me the plugin catalog",
        "which plugins are installed?",
    ],
    INTENT_PATCH: [
        "change argument a to 9",
        "update the river_id to 610217883",
        "set the station argument to 12345",
        "modify the gauge value to 55 on the second visualization",
        "edit visualization 1 to use river_id 5",
        "change the first tile's argument value to 8",
    ],
    INTENT_OOS: [
        "how are you?",
        "what's the weather today?",
        "tell me a joke",
        "who won the game last night?",
        "thanks, that's all",
        "what time is it?",
    ],
}